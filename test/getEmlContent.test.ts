import { SES, SendEmailCommand } from '@aws-sdk/client-ses';
import axios from 'axios';
import { Store } from '../src/store';
import { CreateEmlContentResult } from '../src/emlFile';
import { baseURL } from './globals';

test('can get eml content', async () => {
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
  const storeWithEmails: Store = (await axios({
    method: 'get',
    baseURL,
    url: '/store',
  })).data;
  expect(storeWithEmails.emails).toHaveLength(1);
  const messageId = storeWithEmails.emails[0].messageId;

  const c: CreateEmlContentResult = (await axios({
    method: 'get',
    url: `/get-emlContent?messageId=${messageId}`,
    baseURL,
  })).data;

  expect(c).toMatchObject({
    messageId: messageId,
    fileName: 'This is the subject',
    body: {
      type: "Buffer",
      data: expect.any(Array<String>),
    }
  });
});
