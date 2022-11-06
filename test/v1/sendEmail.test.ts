import { SES, SendEmailCommand } from '@aws-sdk/client-ses';
import axios from 'axios';
import { Store } from '../../src/store';
import { baseURL } from '../globals';

test('can send email with v1 API', async () => {
  const ses = new SES({
    endpoint: baseURL,
    region: 'aws-ses-v2-local',
    credentials: { accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING' },
  });
  await ses.send(new SendEmailCommand({
    Source: 'sender@example.com',
    Destination: { ToAddresses: ['receiver@example.com'] },
    Message: {
      Subject: { Data: 'This is the subject' },
      Body: { Text: { Data: 'This is the email contents' } },
    },
  }));

  const s: Store = (await axios({
    method: 'get',
    baseURL,
    url: '/store',
  })).data;

  expect(s).toMatchInlineSnapshot({
    emails: [
      {
        at: expect.any(Number),
        messageId: expect.any(String),
      }],

  }, `
{
  "emails": [
    {
      "at": Any<Number>,
      "attachments": [],
      "body": {
        "text": "This is the email contents",
      },
      "destination": {
        "bcc": [],
        "cc": [],
        "to": [
          "receiver@example.com",
        ],
      },
      "from": "sender@example.com",
      "messageId": Any<String>,
      "replyTo": [],
      "subject": "This is the subject",
    },
  ],
}
`);
});
