import type {RequestHandler} from 'express';
import ajv from '../ajv';
import {type JSONSchemaType} from 'ajv';
import {saveEmail} from '../store';

const handler: RequestHandler = async (req, res) => {
	const valid = validate(req.body);
	if (!valid) {
		res.status(404).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	if (!req.body['Message.Body.Text.Data'] && !req.body['Message.Body.Html.Data']) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have either a HTML or Text body.'});
		return;
	}

	if (!req.body['Message.Subject.Data']) {
		res.status(400).send({message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a subject.'});
		return;
	}

	const messageId = `ses-${Math.floor((Math.random() * 900000000) + 100000000)}`;

	saveEmail({
		messageId,
		from: req.body.Source,
		replyTo: Object.keys(req.body).filter((k) => k.startsWith('ReplyToAddresses.member.')).map((k) => req.body[k]),
		destination: {
			to: Object.keys(req.body).filter((k) => k.startsWith('Destination.ToAddresses.member.')).map((k) => req.body[k]),
			cc: Object.keys(req.body).filter((k) => k.startsWith('Destination.CcAddresses.member.')).map((k) => req.body[k]),
			bcc: Object.keys(req.body).filter((k) => k.startsWith('Destination.BccAddresses.member.')).map((k) => req.body[k]),
		},
		subject: req.body['Message.Subject.Data'],
		body: {
			text: req.body['Message.Body.Text.Data'],
			html: req.body['Message.Body.Html.Data'],
		},
		attachments: [],
		at: Math.floor(new Date().getTime() / 1000),
	});

	res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><SendEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><SendEmailResult><MessageId>${messageId}</MessageId></SendEmailResult></SendEmailResponse>`);
};

export default handler;

const sendEmailRequestSchema: JSONSchemaType<Record<string, string>> = {
	type: 'object',
	properties: {
		Action: {type: 'string', pattern: '^SendEmail$'},
		Version: {type: 'string'},

		ConfigurationSetName: {type: 'string'},
		'Destination.ToAddresses.member.1': {type: 'string'},
		'Destination.CcAddresses.member.1': {type: 'string'},
		'Destination.BccAddresses.member.1': {type: 'string'},
		'Message.Body.Html.Data': {type: 'string'},
		'Message.Body.Html.Charset': {type: 'string'},
		'Message.Body.Text.Data': {type: 'string'},
		'Message.Body.Text.Charset': {type: 'string'},
		'Message.Subject.Data': {type: 'string'},
		'Message.Subject.Charset': {type: 'string'},
		'ReplyToAddresses.member.1': {type: 'string'},
		ReturnPath: {type: 'string'},
		ReturnPathArn: {type: 'string'},
		Source: {type: 'string'},
		SourceArn: {type: 'string'},
		'Tags.member.1': {type: 'string'},
	},
	required: ['Action', 'Source', 'Message.Subject.Data'],
};

const validate = ajv.compile(sendEmailRequestSchema);
