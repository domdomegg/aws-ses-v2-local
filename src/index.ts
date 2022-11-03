import type { Server } from 'http';
import express from 'express';
import path from 'path';
import v1SendRawEmail from './v1/sendRawEmail';
import v1SendEmail from './v1/sendEmail';
import v2SendEmail from './v2/sendEmail';
import store from './store';

export interface Config {
  port: number,
}

export const defaultConfig: Config = {
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

  app.get('/store-clear', (req, res) => {
    store.emails = [];
    res.status(200).send({ message: 'Emails cleared' });
  });

  app.get('/store', (req, res) => {
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

  app.post('/v2/email/outbound-emails', v2SendEmail);

  app.use((req, res) => {
    res.status(404).send('<UnknownOperationException/>');
  });

  return new Promise((resolve) => {
    const s = app.listen(config.port, () => resolve(s));
  });
};

export default server;
