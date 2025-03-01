import type {RequestHandler} from 'express';
import {type AddressObject, simpleParser} from 'mailparser';
import {saveEmail} from '../store';
import {z} from 'zod';

const sendRawEmailSchema = z.object({
	Action: z.literal('SendRawEmail'),
	Version: z.string().optional(),
	ConfigurationSetName: z.string().optional(),
	'Destinations.member.1': z.string().optional(),
	FromArn: z.string().optional(),
	'RawMessage.Data': z.string(),
	ReturnPathArn: z.string().optional(),
	Source: z.string().optional(),
	SourceArn: z.string().optional(),
	'Tags.member.1': z.string().optional(),
});

const handler: RequestHandler = async (req, res) => {
	const result = sendRawEmailSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	const messageId = `ses-${Math.floor((Math.random() * 900000000) + 100000000)}`;

	const message = await simpleParser(Buffer.from(result.data['RawMessage.Data'], 'base64'));
	const from = message.from?.text ?? result.data.Source;
	if (!from) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Missing source or from value'});
		return;
	}

	saveEmail({
		messageId,
		from,
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

	res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><SendRawEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><SendRawEmailResult><MessageId>${messageId}</MessageId></SendRawEmailResult></SendRawEmailResponse>`);
};

export default handler;
