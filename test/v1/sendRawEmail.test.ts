import {test, expect} from 'vitest';
import {SES, SendRawEmailCommand} from '@aws-sdk/client-ses';
import axios from 'axios';
import {type Store} from '../../src/store';
import {baseURL} from '../globals';

test('can send raw email with v1 API', async () => {
	const ses = new SES({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
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

	expect(s.emails).toMatchObject([
		{
			at: expect.any(Number),
			attachments: [],
			body: {
				html: `<html lang="en">
<head title="">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body>
<div><b>html <i>email test</i></b></div>
<div><span></span></div>
</body>
</html>
`,
				text: 'html email test\n',
			},
			destination: {
				bcc: [],
				cc: [],
				to: [
					'"someone" <someone@example.com>',
				],
			},
			from: '"You" <you@yourapp.com>',
			messageId: expect.any(String),
			replyTo: [],
			subject: 'Test email sent to aws-ses-v2-local!',
		},
	]);
});
