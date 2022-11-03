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

beforeEach(async () => {
  await axios({
    method: 'get',
    baseURL,
    url: '/store-clear',
  });
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

  expect(s).toMatchInlineSnapshot({
    emails: [
      {
        at: expect.any(Number),
        messageId: expect.any(String),
      },
    ],
  }, `
Object {
  "emails": Array [
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
  ],
}
`);
});

test('can send raw email with v2 API and html body', async () => {
  const ses = new SESv2Client({
    endpoint: baseURL,
    region: 'aws-ses-v2-local',
    credentials: { accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING' },
  });
  await ses.send(new SendEmailCommand({
    FromEmailAddress: 'sender@example.com',
    Destination: { ToAddresses: ['receiver@example.com'] },
    Content: {
      Raw: {
        Data: new TextEncoder().encode('From you@yourapp.com Thu Nov  3 11:21:04 2022\n'
+ 'Received: from server.outlook.com\n'
+ ' (2603:10a6:20b:2c9::7) by server.outlook.com with\n'
+ ' HTTPS; Thu, 3 Nov 2022 11:21:04 +0000\n'
+ 'Received: from server.outlook.com\n'
+ ' (2603:10a6:803:9::14) by server.outlook.com\n'
+ ' (2603:10a6:20b:2c9::7) with Microsoft SMTP Server (version=TLS1_2,\n'
+ ' cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.5791.20; Thu, 3 Nov\n'
+ ' 2022 11:21:03 +0000\n'
+ 'Received: from server.outlook.com\n'
+ ' ([fe80::f35a:fca2:5e54:1700]) by server.outlook.com\n'
+ ' ([fe80::f35a:fca2:5e54:1700%7]) with mapi id 15.20.5769.019; Thu, 3 Nov\n'
+ ' 2022 11:21:03 +0000\n'
+ 'From: You <you@yourapp.com>\n'
+ 'To: someone <someone@example.com>\n'
+ 'Subject: Test email sent to aws-ses-v2-local!\n'
+ 'Thread-Topic: Test email sent to aws-ses-v2-local!\n'
+ 'Thread-Index: AQHY73ZbiqO9RQj70UKeJXgQchAkeQ==\n'
+ 'Message-ID: <e59630d301e21fc5ff7b192a89acb6cf50deffeb.camel@example.com>\n'
+ 'Accept-Language: en-US\n'
+ 'Content-Language: en-US\n'
+ 'user-agent: Evolution 3.44.4-0ubuntu1\n'
+ 'Content-Type: multipart/alternative;\n'
+ '\tboundary="_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_"\n'
+ 'MIME-Version: 1.0\n'
+ 'Date: Thu, 03 Nov 2022 11:21:03 +0000\n'
+ 'X-Evolution-Source: 260c3fb2410491c00458de6a70ab024aba447ad4\n'
+ '\n'
+ '--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_\n'
+ 'Content-Type: text/plain; charset="utf-8"\n'
+ 'Content-Transfer-Encoding: 8bit\n'
+ '\n'
+ 'html email test\n'
+ '\n'
+ '--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_\n'
+ 'Content-Type: text/html; charset="utf-8"\n'
+ 'Content-ID: <24D50AE39A965C43B85BDDBA3951BCC2@eurprd06.prod.outlook.com>\n'
+ 'Content-Transfer-Encoding: 8bit\n'
+ '\n'
+ '<html lang="en">\n'
+ '<head title="">\n'
+ '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n'
+ '</head>\n'
+ '<body>\n'
+ '<div><b>html <i>email test</i></b></div>\n'
+ '<div><span></span></div>\n'
+ '</body>\n'
+ '</html>\n'
+ '\n'
+ '--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_--\n'),
      },
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
      },
    ],
  }, `
Object {
  "emails": Array [
    Object {
      "at": Any<Number>,
      "attachments": Array [],
      "body": Object {
        "html": "<html lang=\\"en\\">
<head title=\\"\\">
<meta http-equiv=\\"Content-Type\\" content=\\"text/html; charset=utf-8\\">
</head>
<body>
<div><b>html <i>email test</i></b></div>
<div><span></span></div>
</body>
</html>
",
      },
      "destination": Object {
        "bcc": Array [],
        "cc": Array [],
        "to": Array [
          "someone <someone@example.com>",
        ],
      },
      "from": "You <you@yourapp.com>",
      "messageId": Any<String>,
      "replyTo": Array [],
      "subject": "Test email sent to aws-ses-v2-local!",
    },
  ],
}
`);
});
