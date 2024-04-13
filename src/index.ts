import type { Server } from 'http';
import express from 'express';
import path from 'path';
import v1SendRawEmail from './v1/sendRawEmail';
import v1SendEmail from './v1/sendEmail';
import v2CreateEmailTemplate from './v2/createEmailTemplate';
import v2DeleteEmailTemplate from './v2/deleteEmailTemplate';
import v2GetAccount from './v2/getAccount';
import v2SendEmail from './v2/sendEmail';
import v2SendBulkEmail from './v2/sendBulkEmail';
import { getStoreReadonly, clearStore, Email } from './store';
import { createEmlContent } from './emlFile';

export interface Config {
  host: string,
  port: number,
}

export const defaultConfig: Config = {
  host: 'localhost',
  port: 8005,
};

const server = (partialConfig: Partial<Config> = {}): Promise<Server> => {
  const config: Config = {
    ...defaultConfig,
    ...partialConfig,
  };

  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: false, limit: '25mb' }));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/index.html'));
  });

  app.post('/clear-store', (req, res) => {
    clearStore();
    res.status(200).send({ message: 'Store cleared' });
  });

  app.get('/store', (req, res) => {
    const store = getStoreReadonly();

    if (!req.query.since) {
      res.status(200).send(store);
      return;
    }

    if (typeof req.query.since !== 'string') {
      res.status(400).send({ message: 'Bad since query param, expected single value' });
    }

    const since = parseInt(req.query.since as string, 10);
    if (Number.isNaN(since) || req.query.since !== String(since)) {
      res.status(400).send({ message: 'Bad since query param, expected integer representing epoch timestamp in seconds' });
    }

    res.status(200).send({ ...store, emails: store.emails.filter((e) => e.at >= since) });
  });

  app.get('/health-check', (req, res) => {
    res.status(200).send();
  });

  app.get('/get-emlContent', (req, res) => {
    const store = getStoreReadonly();

    if (typeof req.query.messageId !== 'string' || req.query.messageId === '') {
      res.status(400).send({ message: 'Bad since query param, expected single value' });
    }

    const messageId = req.query.messageId as string;
    const email = store.emails.find((e) => e.messageId === messageId);

    if (email === undefined) {
      res.status(400).send({ message: 'Email not found within the store' });
    }

    createEmlContent(email as Email).then((result) => {
      res.status(200).send(result);
    }).catch((result) => {
      res.status(400).send({ message: result.error });
    });
  });

  app.use((req, res, next) => {
    const authHeader = req.header('authorization');
    if (!authHeader) {
      res.status(403).send({ message: 'Missing Authentication Token', detail: 'aws-ses-v2-local: Must provide some type of authentication, even if only a mock access key' });
      return;
    }
    if (!authHeader.startsWith('AWS')) {
      res.status(400).send({ message: 'Not Authorized', detail: 'aws-ses-v2-local: Authorization type must be AWS' });
      return;
    }
    next();
  });

  app.post('/', (req, res, next) => {
    if (req.body.Action === 'SendEmail') v1SendEmail(req, res, next);
    if (req.body.Action === 'SendRawEmail') v1SendRawEmail(req, res, next);
  });

  // SES V2 - template handling.
  app.post('/v2/email/templates', v2CreateEmailTemplate);
  app.delete('/v2/email/templates/:TemplateName', v2DeleteEmailTemplate);

  // SES V2 - account handling.
  app.get('/v2/email/account', v2GetAccount);

  // SES V2 - email sending.
  app.post('/v2/email/outbound-emails', v2SendEmail);
  app.post('/v2/email/outbound-bulk-emails', v2SendBulkEmail);

  app.use((req, res) => {
    res.status(404).send('<UnknownOperationException/>');
  });

  return new Promise((resolve) => {
    const s = app.listen(config.port, config.host, () => resolve(s));
  });
};

export default server;
