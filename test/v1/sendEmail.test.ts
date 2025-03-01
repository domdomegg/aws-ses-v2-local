import {test, expect} from 'vitest';
import {SES, SendEmailCommand} from '@aws-sdk/client-ses';
import axios from 'axios';
import {type Store} from '../../src/store';
import {baseURL} from '../globals';

test('can send email with v1 API', async () => {
	const ses = new SES({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});
	await ses.send(new SendEmailCommand({
		Source: 'sender@example.com',
		Destination: {ToAddresses: ['receiver@example.com']},
		Message: {
			Subject: {Data: 'This is the subject'},
			Body: {Text: {Data: 'This is the email contents'}},
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
				text: 'This is the email contents',
			},
			destination: {
				bcc: [],
				cc: [],
				to: [
					'receiver@example.com',
				],
			},
			from: 'sender@example.com',
			messageId: expect.any(String),
			replyTo: [],
			subject: 'This is the subject',
		},
	]);
});
