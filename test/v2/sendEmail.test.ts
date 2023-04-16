import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Server } from 'http';
import axios from 'axios';
import server from '../../src/index';
import { Store } from '../../src/store';

let s: Server;
let baseURL: string;

beforeAll(async () => {
  s = await server({ port: 7001 });
  const address = s.address();
  if (address == null) {
    throw new Error('Started server, but didn\'t get an address');
  }
  if (typeof address === 'string') {
    baseURL = address;
  } else if (address.address === '127.0.0.1' || address.address === '::') {
    baseURL = `http://localhost:${address.port}`;
  } else if (address.family === 'IPv4') {
    baseURL = `http://${address.address}:${address.port}`;
  } else if (address.family === 'IPv6') {
    baseURL = `http://[${address.address}]:${address.port}`;
  } else {
    baseURL = `${address.address}:${address.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => s.close((err) => {
    if (err) return reject(err);
    return resolve();
  }));
});

test('can send email with v2 API', async () => {
  const ses = new SESv2Client({
    endpoint: baseURL,
    region: 'aws-ses-v2-local',
    credentials: { accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING' },
  });
  await ses.send(new SendEmailCommand({
    FromEmailAddress: 'sender@example.com',
    Destination: { ToAddresses: ['receiver@example.com'] },
    Content: {
      Simple: {
        Subject: { Data: 'This is the subject' },
        Body: { Text: { Data: 'This is the email contents' } },
      },
    },
  }));

  const s: Store = (await axios({
    method: 'get',
    baseURL,
    url: '/store',
  })).data;

  expect(s.emails).toMatchInlineSnapshot(
    [
      { at: expect.any(Number),
        messageId: expect.any(String) }], `
Array [
  Object {
    "at": Any<Number>,
    "attachments": Array [],
    "body": Object {
      "text": "This is the email contents",
    },
    "destination": Object {
      "bcc": Array [],
      "cc": Array [],
      "to": Array [
        "receiver@example.com",
      ],
    },
    "from": "sender@example.com",
    "messageId": Any<String>,
    "replyTo": Array [],
    "subject": "This is the subject",
  },
]
`,
  );
});
