import type {RequestHandler} from 'express';
import {type AddressObject, simpleParser} from 'mailparser';
import {saveEmail} from '../store';
import {z} from 'zod';
import {charsetDataSchema, emailAddressListSchema} from '../validation';

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
		}).optional(),
		Template: z.object({
			TemplateArn: z.string().optional(),
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
	} else {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have either Simple or Raw content. Want to add support for other types of emails? Open a PR!'});
	}
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
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address. Want to add support for other types of emails? Open a PR!'});
		return;
	}

	const messageId = `ses-${Math.floor((Math.random() * 900000000) + 100000000)}`;

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
		attachments: [],
		at: Math.floor(new Date().getTime() / 1000),
	});

	res.status(200).send({MessageId: messageId});
};

const handleRaw: RequestHandler = async (req, res) => {
	const data = sendEmailSchema.parse(req.body);
	const messageId = `ses-${Math.floor((Math.random() * 900000000) + 100000000)}`;

	if (!data.Content?.Raw?.Data) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Raw content must have data.'});
		return;
	}

	const message = await simpleParser(Buffer.from(data.Content.Raw.Data, 'base64'));

	if (!message.from?.text) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Raw content must have a from address.'});
		return;
	}

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
		at: Math.floor(new Date().getTime() / 1000),
	});

	res.status(200).send({MessageId: messageId});
};

export default handler;
