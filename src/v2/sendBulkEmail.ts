import type {RequestHandler} from 'express';
import {
	type Email, getTemplate, hasTemplate, saveEmail,
} from '../store';
import isEmailValid from '../isEmailValid';
import {z} from 'zod';
import {getCurrentTimestamp} from '../util';
import {
	compileTemplate, parseTemplateData, TemplateRenderError, type TemplateData,
} from './renderTemplate';

type BulkEmailResult = {
	MessageId: string;
	Error?: string;
	Status: string;
};

const replacementSchema = z.object({
	Name: z.string(),
	Value: z.string(),
});

const sendBulkEmailSchema = z.object({
	BulkEmailEntries: z.array(z.object({
		Destination: z.object({
			BccAddresses: z.array(z.string()).optional(),
			CcAddresses: z.array(z.string()).optional(),
			ToAddresses: z.array(z.string()),
		}),
		ReplacementEmailContent: z.object({
			ReplacementTemplate: z.object({
				ReplacementTemplateData: z.string(),
			}),
		}).optional(),
		ReplacementTags: z.array(replacementSchema).optional(),
	})),
	ConfigurationSetName: z.string().optional(),
	DefaultContent: z.object({
		Template: z.object({
			TemplateArn: z.string().optional(),
			TemplateData: z.string().optional(),
			TemplateName: z.string().optional(),
			TemplateContent: z.object({
				Subject: z.string(),
				Html: z.string().optional(),
				Text: z.string().optional(),
			}).optional(),
		}),
	}),
	DefaultEmailTags: z.array(replacementSchema).optional(),
	FeedbackForwardingEmailAddress: z.string().optional(),
	FeedbackForwardingEmailAddressIdentityArn: z.string().optional(),
	FromEmailAddress: z.string(),
	FromEmailAddressIdentityArn: z.string().optional(),
	ReplyToAddresses: z.array(z.string()).optional(),
});

// Not certain whether the `next` argument is necessary for express
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler: RequestHandler = (req, res, next) => {
	const result = sendBulkEmailSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	if (!result.data.FromEmailAddress) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address.'});
		return;
	}

	const fromEmailAddress = result.data.FromEmailAddress;
	const replyToAddresses = result.data.ReplyToAddresses ?? [];
	const defaultContent = result.data.DefaultContent;

	// Try to retrieve the template.
	const templateName = defaultContent.Template.TemplateName;
	let templateSubject = '';
	let templateHtml = '';
	let templateText = '';

	if (templateName) {
		if (!hasTemplate(templateName)) {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Unable to find the template: ${templateName}.`});
			return;
		}

		const template = getTemplate(templateName);
		templateSubject = template?.TemplateContent.Subject ?? '';
		templateHtml = template?.TemplateContent.Html ?? '';
		templateText = template?.TemplateContent.Text ?? '';
	} else if (defaultContent.Template.TemplateContent) {
		templateSubject = defaultContent.Template.TemplateContent?.Subject ?? '';
		templateHtml = defaultContent.Template.TemplateContent.Html ?? '';
		templateText = defaultContent.Template.TemplateContent.Text ?? '';
	} else {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide either a template name or template content.'});
		return;
	}

	if (!templateSubject || (!templateHtml && !templateText)) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide a subject and either an HTML or text body in the template.'});
		return;
	}

	// Default template replacement data (applied to every recipient unless overridden).
	const defaultTemplateData = parseTemplateData(defaultContent.Template.TemplateData);
	if (defaultTemplateData instanceof Error) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: ${defaultTemplateData.message}`});
		return;
	}

	// Compile each template part once; reused for every recipient.
	let renderSubject: (d: TemplateData) => string;
	let renderHtml: (d: TemplateData) => string;
	let renderText: (d: TemplateData) => string;
	try {
		renderSubject = compileTemplate(templateSubject);
		renderHtml = compileTemplate(templateHtml);
		renderText = compileTemplate(templateText);
	} catch (error: unknown) {
		const detail = error instanceof Error ? error.message : String(error);
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: template rendering failed - ${detail}`});
		return;
	}

	const results: BulkEmailResult[] = [];
	// Process each destination.
	result.data.BulkEmailEntries.forEach((entry, index) => {
		const messageId = `ses-${Math.floor((Math.random() * 900000000) + 100000000 + index)}`;

		// Validate destination email address.
		const allEmails = [...entry.Destination.ToAddresses, ...entry.Destination.CcAddresses ?? [], ...entry.Destination.BccAddresses ?? []];
		if (!allEmails.every(isEmailValid)) {
			results.push({
				MessageId: messageId,
				Error: 'Invalid recipient email address(es)',
				Status: 'FAILED',
			});
			return;
		}

		const replacementData = parseTemplateData(entry.ReplacementEmailContent?.ReplacementTemplate?.ReplacementTemplateData);
		if (replacementData instanceof Error) {
			results.push({
				MessageId: messageId,
				Error: replacementData.message,
				Status: 'FAILED',
			});
			return;
		}

		// Per-recipient data overrides the batch default data (shallow, per SES fallback semantics).
		const templateData: TemplateData = {...defaultTemplateData, ...replacementData};

		let subject: string;
		let html: string;
		let text: string;
		try {
			subject = renderSubject(templateData);
			html = renderHtml(templateData);
			text = renderText(templateData);
		} catch (error: unknown) {
			if (!(error instanceof TemplateRenderError)) {
				throw error; // surface unexpected errors instead of masking them as a per-recipient FAILED
			}

			results.push({
				MessageId: messageId,
				Error: `Rendering failure: ${error.message}`,
				Status: 'FAILED',
			});
			return;
		}

		const email: Email = {
			messageId,
			from: fromEmailAddress,
			replyTo: replyToAddresses,
			destination: {
				to: entry.Destination.ToAddresses,
				cc: entry.Destination?.CcAddresses ?? [],
				bcc: entry.Destination?.BccAddresses ?? [],
			},
			subject,
			body: {
				html,
				text,
			},
			attachments: [],
			at: getCurrentTimestamp(),
		};

		saveEmail(email);

		results.push({
			MessageId: messageId,
			Status: 'SUCCESS',
		});
	});

	res.status(200).send({BulkEmailEntryResults: results});
};

export default handler;
