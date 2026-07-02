import type {RequestHandler} from 'express';
import {type AddressObject, simpleParser} from 'mailparser';
import {getTemplate, hasTemplate, saveEmail} from '../store';
import {z} from 'zod';
import {charsetDataSchema, emailAddressListSchema} from '../validation';
import {getCurrentTimestamp, getMessageId} from '../util';
import {parseTemplateData, renderTemplate, TemplateRenderError} from './renderTemplate';

const attachmentSchema = z.object({
	FileName: z.string(),
	RawContent: z.string(), // base64-encoded blob
	ContentType: z.string().optional(),
	ContentDescription: z.string().optional(),
	ContentDisposition: z.string().optional(),
	ContentId: z.string().optional(),
	ContentTransferEncoding: z.string().optional(),
});

type Attachment = z.infer<typeof attachmentSchema>;

const sendEmailSchema = z.object({
	ConfigurationSetName: z.string().optional(),
	Content: z.object({
		Raw: z.object({
			Data: z.string(), // base-64 encoded blob
		}).optional(),
		Simple: z.object({
			Body: z.object({
				Html: z.object({
					Charset: z.string().optional(),
					Data: z.string(),
				}).optional(),
				Text: z.object({
					Charset: z.string().optional(),
					Data: z.string(),
				}).optional(),
			}),
			Subject: charsetDataSchema,
			Attachments: z.array(attachmentSchema).optional(),
		}).optional(),
		Template: z.object({
			Attachments: z.array(attachmentSchema).optional(),
			// Headers
			// TemplateArn
			// TemplateContent
			TemplateData: z.string().optional(),
			TemplateName: z.string().optional(),
		}).optional(),
	}),
	Destination: emailAddressListSchema.optional(),
	EmailTags: z.array(z.object({
		Name: z.string(),
		Value: z.string(),
	})).optional(),
	FeedbackForwardingEmailAddress: z.string().optional(),
	FeedbackForwardingEmailAddressIdentityArn: z.string().optional(),
	FromEmailAddress: z.string().optional(),
	FromEmailAddressIdentityArn: z.string().optional(),
	ListManagementOptions: z.object({
		ContactListName: z.string().optional(),
		TopicName: z.string().optional(),
	}).optional(),
	ReplyToAddresses: z.array(z.string()).optional(),
});

const handler: RequestHandler = (req, res, next) => {
	const result = sendEmailSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	if (result.data.Content?.Simple) {
		handleSimple(req, res, next);
	} else if (result.data.Content?.Raw) {
		handleRaw(req, res, next);
	} else if (result.data.Content?.Template) {
		handleTemplate(req, res, next);
	} else {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have either Simple or Raw content. Want to add support for other types of emails? Open a PR!'});
	}
};

const transformAttachments = (attachments?: Attachment[]) => {
	return (attachments ?? []).map((att) => {
		const content = Buffer.from(att.RawContent, 'base64');
		return {
			content: att.RawContent,
			contentType: att.ContentType ?? 'application/octet-stream',
			contentDisposition: att.ContentDisposition,
			contentId: att.ContentId,
			filename: att.FileName,
			size: content.length,
		};
	});
};

const handleSimple: RequestHandler = async (req, res) => {
	const data = sendEmailSchema.parse(req.body);
	if (!data.Content?.Simple?.Body?.Html?.Data && !data.Content?.Simple?.Body?.Text?.Data) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Simple content must have either a HTML or Text body.'});
		return;
	}

	if (!data.Content?.Simple?.Subject?.Data) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Simple content must have a subject.'});
		return;
	}

	if (!data.FromEmailAddress) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address.'});
		return;
	}

	const messageId = getMessageId();

	const attachments = transformAttachments(data.Content.Simple.Attachments);

	saveEmail({
		messageId,
		from: data.FromEmailAddress,
		replyTo: data.ReplyToAddresses ?? [],
		destination: {
			to: data.Destination?.ToAddresses ?? [],
			cc: data.Destination?.CcAddresses ?? [],
			bcc: data.Destination?.BccAddresses ?? [],
		},
		subject: data.Content.Simple.Subject.Data,
		body: {
			html: data.Content.Simple.Body.Html?.Data,
			text: data.Content.Simple.Body.Text?.Data,
		},
		attachments,
		at: getCurrentTimestamp(),
	});

	res.status(200).send({MessageId: messageId});
};

const handleRaw: RequestHandler = async (req, res) => {
	const data = sendEmailSchema.parse(req.body);
	if (!data.Content?.Raw?.Data) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Raw content must have data.'});
		return;
	}

	const message = await simpleParser(Buffer.from(data.Content.Raw.Data, 'base64'));

	if (!message.from?.text) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Raw content must have a from address.'});
		return;
	}

	const messageId = getMessageId();

	saveEmail({
		messageId,
		from: message.from?.text,
		replyTo: message.replyTo ? [message.replyTo.text] : [],
		destination: {
			to: (Array.isArray(message.to) ? message.to : [message.to || null]).filter((m): m is AddressObject => Boolean(m)).map((a) => a.text),
			cc: (Array.isArray(message.cc) ? message.cc : [message.cc || null]).filter((m): m is AddressObject => Boolean(m)).map((a) => a.text),
			bcc: (Array.isArray(message.bcc) ? message.bcc : [message.bcc || null]).filter((m): m is AddressObject => Boolean(m)).map((a) => a.text),
		},
		subject: message.subject ?? '(no subject)',
		body: {
			text: message.text,
			html: message.html || undefined,
		},
		attachments: message.attachments.map((a) => ({...a, content: a.content.toString('base64')})),
		at: getCurrentTimestamp(),
	});

	res.status(200).send({MessageId: messageId});
};

const handleTemplate: RequestHandler = (req, res) => {
	const data = sendEmailSchema.parse(req.body);
	if (!data.Content?.Template) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Raw content must have data.'});
		return;
	}

	const {TemplateName, TemplateData} = data.Content.Template;

	if (!TemplateName) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Template content must have a template name.'});
		return;
	}

	if (!data.FromEmailAddress) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address.'});
		return;
	}

	const template = getTemplate(TemplateName);
	if (!hasTemplate(TemplateName) || !template?.TemplateName || !template?.TemplateContent) {
		res.status(404).send({type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.'});
		return;
	}

	const templateData = parseTemplateData(TemplateData);
	if (templateData instanceof Error) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: ${templateData.message}`});
		return;
	}

	let subject: string;
	let htmlBody: string;
	let textBody: string;
	try {
		subject = renderTemplate(template.TemplateContent.Subject ?? '', templateData);
		htmlBody = renderTemplate(template.TemplateContent.Html ?? '', templateData);
		textBody = renderTemplate(template.TemplateContent.Text ?? '', templateData);
	} catch (error: unknown) {
		if (error instanceof TemplateRenderError) {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: template rendering failed - ${error.message}`});
			return;
		}

		throw error;
	}

	const messageId = getMessageId();

	const attachments = transformAttachments(data.Content.Template.Attachments);

	saveEmail({
		messageId,
		from: data.FromEmailAddress,
		replyTo: data.ReplyToAddresses ?? [],
		destination: {
			to: data.Destination?.ToAddresses ?? [],
			cc: data.Destination?.CcAddresses ?? [],
			bcc: data.Destination?.BccAddresses ?? [],
		},
		subject,
		body: {
			html: htmlBody,
			text: textBody,
		},
		attachments,
		at: getCurrentTimestamp(),
	});

	res.status(200).send({MessageId: messageId});
};

export default handler;
