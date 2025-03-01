import {test, expect} from 'vitest';
import {SES, SendEmailCommand} from '@aws-sdk/client-ses';
import axios from 'axios';
import {type Store} from '../src/store';
import {baseURL} from './globals';

test('can clear emails', async () => {
	// Given: we have emails in the store
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

	// When: we clear the store
	await axios({
		method: 'post',
		url: '/clear-store',
		baseURL,
	});

	// Then: the store is empty
	const emptyStore: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;
	expect(emptyStore.emails).toHaveLength(0);
});
