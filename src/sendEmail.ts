import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';
import ajv from './ajv';
import store from './store';

const handler: RequestHandler = (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ message: 'Bad Request Exception', detail: 'Schema validation failed' });
    return;
  }

  if (!req.body.Content?.Simple?.Body?.Html?.Data && !req.body.Content?.Simple?.Body?.Text?.Data) {
    res.status(400).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have Simple content with either a HTML or Text body. Want to add support for other types of emails? Open a PR!' });
    return;
  }

  if (!req.body.Content?.Simple?.Subject?.Data) {
    res.status(400).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have Simple content with a subject. Want to add support for other types of emails? Open a PR!' });
    return;
  }

  if (!req.body.FromEmailAddress) {
    res.status(400).send({ message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must have a from email address. Want to add support for other types of emails? Open a PR!' });
    return;
  }

  const messageId = `ses-${Math.floor(Math.random() * 900000000 + 100000000)}`;

  store.emails.push({
    messageId,
    from: req.body.FromEmailAddress,
    replyTo: req.body.ReplyToAddresses ?? [],
    destination: {
      to: req.body.Destination?.ToAddresses ?? [],
      cc: req.body.Destination?.CcAddresses ?? [],
      bcc: req.body.Destination?.BccAddresses ?? [],
    },
    subject: req.body.Content.Simple.Subject.Data,
    body: {
      html: req.body.Content.Simple.Body.Html?.Data,
      text: req.body.Content.Simple.Body.Text?.Data,
    },
    at: Math.floor(new Date().getTime() / 1000),
  });

  res.status(200).send({ MessageId: messageId });
};

export default handler;

const sendEmailRequestSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    ConfigurationSetName: { type: 'string' },
    Content: {
      type: 'object',
      properties: {
        Raw: {
          type: 'object',
          properties: {
            Data: { type: 'string' }, // base-64 encoded blob
          },
        },
        Simple: {
          type: 'object',
          properties: {
            Body: {
              type: 'object',
              properties: {
                Html: {
                  type: 'object',
                  properties: {
                    Charset: { type: 'string' },
                    Data: { type: 'string' },
                  },
                  required: ['Data'],
                },
                Text: {
                  type: 'object',
                  properties: {
                    Charset: { type: 'string' },
                    Data: { type: 'string' },
                  },
                  required: ['Data'],
                },
              },
            },
            Subject: {
              type: 'object',
              properties: {
                Charset: { type: 'string' },
                Data: { type: 'string' },
              },
              required: ['Data'],
            },
          },
          required: ['Body', 'Subject'],
        },
        Template: {
          type: 'object',
          properties: {
            TemplateArn: { type: 'string' },
            TemplateData: { type: 'string' },
            TemplateName: { type: 'string' },
          },
        },
      },
    },
    Destination: {
      type: 'object',
      properties: {
        BccAddresses: { type: 'array', items: { type: 'string' } },
        CcAddresses: { type: 'array', items: { type: 'string' } },
        ToAddresses: { type: 'array', items: { type: 'string' } },
      },
    },
    EmailTags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Name: { type: 'string' },
          Value: { type: 'string' },
        },
      },
    },
    FeedbackForwardingEmailAddress: { type: 'string' },
    FeedbackForwardingEmailAddressIdentityArn: { type: 'string' },
    FromEmailAddress: { type: 'string' },
    FromEmailAddressIdentityArn: { type: 'string' },
    ListManagementOptions: {
      type: 'object',
      properties: {
        ContactListName: { type: 'string' },
        TopicName: { type: 'string' },
      },
    },
    ReplyToAddresses: { type: 'array', items: { type: 'string' } },
  },
  required: ['Content'],
};

const validate = ajv.compile(sendEmailRequestSchema);
