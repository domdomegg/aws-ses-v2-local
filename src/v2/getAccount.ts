import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';
import ajv from '../ajv';
import store from '../store';

const handler: RequestHandler = (req, res, next) => {
  if (!process.env.AWS_SES_ACCOUNT) {
    res.status(400).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Account not found' });
    return;
  }

  const account = JSON.parse(process.env.AWS_SES_ACCOUNT);
  if (!validate(account)) {
    res.status(404).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  res.status(200).send(account)
};

export default handler;

const accountSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    DedicatedIpAutoWarmupEnabled: { type: 'boolean' },
    Details: {
      type: 'object',
      properties: {
        AdditionalContactEmailAddresses: { type: 'array', items: { type: 'string' } },
        ContactLanguage: { type: 'string' },
        MailType: { type: 'string' },
        ReviewDetails: {
          type: 'object',
          properties: {
            CaseId: { type: 'string' },
            Status: { type: 'string' },
          },
        },
        UseCaseDescription: { type: 'string' },
        WebsiteURL: { type: 'string' },
      },
    },
    EnforcementStatus: { type: 'string' },
    ProductionAccessEnabled: { type: 'boolean' },
    SendingEnabled: { type: 'boolean' },
    SendQuota: {
      type: 'object',
      properties: {
        Max24HourSend: { type: 'number' },
        MaxSendRate: { type: 'number' },
        SentLast24Hours: { type: 'number' },
      },
    },
    SuppressionAttributes: {
      type: 'object',
      properties: {
        SuppressedReasons: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

const validate = ajv.compile(accountSchema);
