import { SES, SendRawEmailCommand } from '@aws-sdk/client-ses';
import type { Server } from 'http';
import axios from 'axios';
import server from '../../src/index';
import { Store } from '../../src/store';

let s: Server;
let baseURL: string;

beforeAll(async () => {
  s = await server({ port: 7002 });
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

test('can send raw email with v1 API', async () => {
  const ses = new SES({
    endpoint: baseURL,
    region: 'aws-ses-v2-local',
    credentials: { accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING' },
  });
  await ses.send(new SendRawEmailCommand({
    RawMessage: {
      Data: new TextEncoder().encode(`From you@yourapp.com Thu Nov  3 11:21:04 2022
Received: from server.outlook.com
 (2603:10a6:20b:2c9::7) by server.outlook.com with
 HTTPS; Thu, 3 Nov 2022 11:21:04 +0000
Received: from server.outlook.com
 (2603:10a6:803:9::14) by server.outlook.com
 (2603:10a6:20b:2c9::7) with Microsoft SMTP Server (version=TLS1_2,
 cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.5791.20; Thu, 3 Nov
 2022 11:21:03 +0000
Received: from server.outlook.com
 ([fe80::f35a:fca2:5e54:1700]) by server.outlook.com
 ([fe80::f35a:fca2:5e54:1700%7]) with mapi id 15.20.5769.019; Thu, 3 Nov
 2022 11:21:03 +0000
From: You <you@yourapp.com>
To: someone <someone@example.com>
Subject: Test email sent to aws-ses-v2-local!
Thread-Topic: Test email sent to aws-ses-v2-local!
Thread-Index: AQHY73ZbiqO9RQj70UKeJXgQchAkeQ==
Message-ID: <e59630d301e21fc5ff7b192a89acb6cf50deffeb.camel@example.com>
Accept-Language: en-US
Content-Language: en-US
user-agent: Evolution 3.44.4-0ubuntu1
Content-Type: multipart/alternative;
    boundary="_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_"
MIME-Version: 1.0
Date: Thu, 03 Nov 2022 11:21:03 +0000
X-Evolution-Source: 260c3fb2410491c00458de6a70ab024aba447ad4

--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: 8bit

html email test

--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_
Content-Type: text/html; charset="utf-8"
Content-ID: <24D50AE39A965C43B85BDDBA3951BCC2@eurprd06.prod.outlook.com>
Content-Transfer-Encoding: 8bit

<html lang="en">
<head title="">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body>
<div><b>html <i>email test</i></b></div>
<div><span></span></div>
</body>
</html>

--_000_e59630d301e21fc5ff7b192a89acb6cf50deffebcamelexamplec_--
`),
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
        "text": "html email test
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
