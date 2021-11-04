import type { Server } from 'http';
import express from 'express';
import path from 'path';
import sendEmail from './sendEmail';
import store from './store';

export interface Config {
  port: number,
}

export const defaultConfig: Config = {
  port: 8005,
};

const server = (partialConfig: Partial<Config> = {}): Server => {
  const config: Config = {
    ...defaultConfig,
    ...partialConfig,
  };

  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  app.get('/store', (req, res) => {
    res.status(200).send(store);
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

  app.post('/v2/email/outbound-emails', sendEmail);

  app.use((req, res) => {
    res.status(404).send('<UnknownOperationException/>');
  });

  return app.listen(config.port);
};

export default server;
