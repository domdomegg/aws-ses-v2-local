import type {RequestHandler} from 'express';
import {saveEmail} from '../store';
import {z} from 'zod';
import {getCurrentTimestamp, getMessageId} from '../util';

const sendEmailSchema = z.object({
	Action: z.literal('SendEmail'),
	Version: z.string().optional(),
	ConfigurationSetName: z.string().optional(),
	'Destination.ToAddresses.member.1': z.string().optional(),
	'Destination.CcAddresses.member.1': z.string().optional(),
	'Destination.BccAddresses.member.1': z.string().optional(),
	'Message.Body.Html.Data': z.string().optional(),
	'Message.Body.Html.Charset': z.string().optional(),
	'Message.Body.Text.Data': z.string().optional(),
	'Message.Body.Text.Charset': z.string().optional(),
	'Message.Subject.Data': z.string(),
	'Message.Subject.Charset': z.string().optional(),
	'ReplyToAddresses.member.1': z.string().optional(),
	ReturnPath: z.string().optional(),
	ReturnPathArn: z.string().optional(),
	Source: z.string(),
	SourceArn: z.string().optional(),
	'Tags.member.1': z.string().optional(),
});

const handler: RequestHandler = async (req, res) => {
	const result = sendEmailSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	if (!result.data['Message.Body.Text.Data'] && !result.data['Message.Body.Html.Data']) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have either a HTML or Text body.'});
		return;
	}

	if (!result.data['Message.Subject.Data']) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a subject.'});
		return;
	}

	const messageId = getMessageId();

	saveEmail({
		messageId,
		from: result.data.Source,
		replyTo: stringKeysBeginningWith(result.data, 'ReplyToAddresses.member.'),
		destination: {
			to: stringKeysBeginningWith(result.data, 'Destination.ToAddresses.member.'),
			cc: stringKeysBeginningWith(result.data, 'Destination.CcAddresses.member.'),
			bcc: stringKeysBeginningWith(result.data, 'Destination.BccAddresses.member.'),
		},
		subject: result.data['Message.Subject.Data'],
		body: {
			text: result.data['Message.Body.Text.Data'],
			html: result.data['Message.Body.Html.Data'],
		},
		attachments: [],
		at: getCurrentTimestamp(),
	});

	res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><SendEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><SendEmailResult><MessageId>${messageId}</MessageId></SendEmailResult></SendEmailResponse>`);
};

const stringKeysBeginningWith = (obj: Record<string, unknown>, prefix: string): string[] => {
	return Object.keys(obj)
		.filter((k) => k.startsWith(prefix))
		.map((k) => {
			const result = obj[k];
			if (typeof result !== 'string') {
				throw new Error(`Expected the value for '${k}' to be a string, but got a ${typeof result}`);
			}

			return result;
		});
};

export default handler;
