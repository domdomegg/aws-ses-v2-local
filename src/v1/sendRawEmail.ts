import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';
import { AddressObject, simpleParser } from 'mailparser';
import ajv from '../ajv';
import { saveEmail } from '../store';

const handler: RequestHandler = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  const messageId = `ses-${Math.floor(Math.random() * 900000000 + 100000000)}`;

  const message = await simpleParser(Buffer.from(req.body['RawMessage.Data'], 'base64'));

  saveEmail({
    messageId,
    from: message.from?.text ?? req.body.Source,
    replyTo: message.replyTo ? [message.replyTo.text] : [],
    destination: {
      to: (Array.isArray(message.to) ? message.to : [message.to || null]).filter((m): m is AddressObject => !!m).map((a) => a.text),
      cc: (Array.isArray(message.cc) ? message.cc : [message.cc || null]).filter((m): m is AddressObject => !!m).map((a) => a.text),
      bcc: (Array.isArray(message.bcc) ? message.bcc : [message.bcc || null]).filter((m): m is AddressObject => !!m).map((a) => a.text),
    },
    subject: message.subject ?? '(no subject)',
    body: {
      text: message.text,
    },
    attachments: message.attachments.map((a) => ({ ...a, content: a.content.toString('base64') })),
    at: Math.floor(new Date().getTime() / 1000),
  });

  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><SendRawEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><SendRawEmailResult><MessageId>${messageId}</MessageId></SendRawEmailResult></SendRawEmailResponse>`);
};

export default handler;

const sendRawEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    Action: { type: 'string', pattern: '^SendRawEmail$' },
    Version: { type: 'string' },

    ConfigurationSetName: { type: 'string' },
    'Destinations.member.1': { type: 'string' },
    FromArn: { type: 'string' },
    'RawMessage.Data': { type: 'string' },
    ReturnPathArn: { type: 'string' },
    Source: { type: 'string' },
    SourceArn: { type: 'string' },
    'Tags.member.1': { type: 'string' },
  },
  required: ['Action', 'Source', 'RawMessage.Data'],
};

const validate = ajv.compile(sendRawEmailRequestSchema);
