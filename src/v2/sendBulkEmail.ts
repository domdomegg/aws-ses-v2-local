import type {RequestHandler} from 'express';
import {type Email, saveEmail} from '../store';
import isEmailValid from '../isEmailValid';
import {z} from 'zod';
import {getCurrentTimestamp} from '../util';
import {messageHeadersSchema} from '../validation';
import {
	compileTemplateParts, parseTemplateData, resolveTemplateParts, strictTemplateRenderingEnabled, TemplateRenderError, type TemplateData,
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
			Headers: messageHeadersSchema,
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

	// Resolve the template (by name, ARN, or inline content) — shared with SendEmail.
	const resolved = resolveTemplateParts(defaultContent.Template);
	if ('error' in resolved) {
		if (resolved.error === 'not-found') {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Unable to find the template: ${resolved.name}.`});
		} else if (resolved.error === 'invalid-arn') {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Invalid template ARN.'});
		} else {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide either a template name or template content.'});
		}

		return;
	}

	const {Subject: templateSubject = '', Html: templateHtml = '', Text: templateText = ''} = resolved.parts;

	if (!templateSubject || (!templateHtml && !templateText)) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide a subject and either an HTML or text body in the template.'});
		return;
	}

	const defaultTemplateData = parseTemplateData(defaultContent.Template.TemplateData);
	if (defaultTemplateData instanceof Error) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: ${defaultTemplateData.message}`});
		return;
	}

	// Compile once; reused for every recipient.
	const strict = strictTemplateRenderingEnabled();
	let renderParts: (d: TemplateData) => {subject: string; html: string; text: string};
	try {
		renderParts = compileTemplateParts({Subject: templateSubject, Html: templateHtml, Text: templateText}, {strict});
	} catch (error: unknown) {
		if (!(error instanceof TemplateRenderError)) {
			throw error;
		}

		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: template rendering failed - ${error.message}`});
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

		const replacementData = parseTemplateData(entry.ReplacementEmailContent?.ReplacementTemplate?.ReplacementTemplateData, 'ReplacementTemplateData');
		if (replacementData instanceof Error) {
			results.push({
				MessageId: messageId,
				Error: replacementData.message,
				Status: 'FAILED',
			});
			return;
		}

		// Whole-object fallback (SES semantics): defaults apply only when the entry supplies no
		// replacement data ({} or absent); any replacement data is used on its own, not merged per-key.
		const templateData: TemplateData = Object.keys(replacementData).length > 0 ? replacementData : defaultTemplateData;

		let subject: string;
		let html: string;
		let text: string;
		try {
			({subject, html, text} = renderParts(templateData));
		} catch (error: unknown) {
			if (!(error instanceof TemplateRenderError)) {
				throw error; // surface unexpected errors instead of masking them as a per-recipient FAILED
			}

			results.push({
				MessageId: messageId,
				Error: `template rendering failed - ${error.message}`,
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
			headers: defaultContent.Template.Headers?.map((h) => ({name: h.Name, value: h.Value})),
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
