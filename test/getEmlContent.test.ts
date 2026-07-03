import {test, expect} from 'vitest';
import {SES, SendEmailCommand} from '@aws-sdk/client-ses';
import {SESv2Client, SendEmailCommand as SendEmailV2Command} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import {type Store} from '../src/store';
import {type CreateEmlContentResult} from '../src/emlFile';
import {baseURL} from './globals';

test('can get eml content', async () => {
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
	const storeWithEmails: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;
	expect(storeWithEmails.emails).toHaveLength(1);
	const {messageId} = storeWithEmails.emails[0]!;

	const c: CreateEmlContentResult = (await axios({
		method: 'get',
		url: `/get-emlContent?messageId=${messageId}`,
		baseURL,
	})).data;

	expect(c).toMatchObject({
		messageId,
		fileName: 'This is the subject',
		body: {
			type: 'Buffer',
			data: expect.any(Array<string>),
		},
	});
});

test('includes custom headers in the eml content', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});
	await ses.send(new SendEmailV2Command({
		FromEmailAddress: 'sender@example.com',
		Destination: {ToAddresses: ['receiver@example.com']},
		Content: {
			Template: {
				TemplateContent: {Subject: 'Hi', Text: 'Hi'},
				TemplateData: '{}',
				Headers: [{Name: 'X-Campaign', Value: 'summer-sale'}],
			},
		},
	}));

	const storeWithEmails: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;
	const {messageId} = storeWithEmails.emails[0]!;

	const c: CreateEmlContentResult = (await axios({
		method: 'get',
		url: `/get-emlContent?messageId=${messageId}`,
		baseURL,
	})).data;

	const mime = Buffer.from((c.body as unknown as {data: number[]}).data).toString('utf-8');
	expect(mime).toContain('X-Campaign: summer-sale');
});
