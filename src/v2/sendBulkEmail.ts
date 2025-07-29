import type {RequestHandler} from 'express';
import {
	type Email, getTemplate, hasTemplate, saveEmail,
} from '../store';
import isEmailValid from '../isEmailValid';
import {z} from 'zod';
import { getCurrentTimestamp } from '../util';

type Replacement = {
	Name: string;
	Value: string;
};

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

	// Default template replacement data.
	const defaultTemplateData = decodeTemplateData(defaultContent.Template?.TemplateData);
	if (defaultTemplateData instanceof Error) {
		res.status(400).send(defaultTemplateData);
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

		const templateData = decodeTemplateData(entry.ReplacementEmailContent?.ReplacementTemplate?.ReplacementTemplateData);
		if (templateData instanceof Error) {
			res.status(400).send(templateData);
			return;
		}

		const subject = replaceTemplateData(templateSubject, templateData, defaultTemplateData);
		const html = replaceTemplateData(templateHtml, templateData, defaultTemplateData);
		const text = replaceTemplateData(templateText, templateData, defaultTemplateData);

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

/**
 * Decode template data.
 *
 * Template data is passed in as a JSON string that contains key-value pairs. The keys correspond to the variables in the template and values represent the content that replaces the variables in the email. https://docs.aws.amazon.com/ses/latest/dg/send-personalized-email-api.html  https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_Template.html
 * eg. '{"name":"John Doe"}' as templateData with template 'Hello {{name}}' would result in 'Hello John Doe'
 */
const decodeTemplateData = (templateData = '{}'): Replacement[] | Error => {
	try {
		const parsed = JSON.parse(templateData);
		const errors: string[] = [];
		const replacements: Replacement[] = [];

		Object.entries(parsed).forEach(([key, value]) => {
			if (typeof value !== 'string') {
				errors.push(`Invalid replacement data found in key "${key}": expected string, got ${typeof value}`);
				return;
			}

			replacements.push({
				Name: key,
				Value: value,
			});
		});

		if (errors.length > 0) {
			return new Error(`Template validation failed:\n${errors.join('\n')}`);
		}

		return replacements;
	} catch (error: unknown) {
		return new Error(`Failed to parse template data: ${String(error)}`);
	}
};

/**
 * Replace template data.
 */
function replaceTemplateData(content: string, replacements: Replacement[] = [], defaultReplacements: Replacement[] = []): string {
	let newContent = content;
	replacements.forEach((item) => {
		newContent = newContent.replaceAll(`{{${item.Name}}}`, item.Value);
	});
	defaultReplacements.forEach((item) => {
		newContent = newContent.replaceAll(`{{${item.Name}}}`, item.Value);
	});
	return newContent;
}

export default handler;
