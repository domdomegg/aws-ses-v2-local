import {test, expect} from 'vitest';
import {SESv2Client, DeleteEmailTemplateCommand, CreateEmailTemplateCommand} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import {baseURL} from '../globals';

test('can delete existing email template', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'template-to-delete';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {
			Subject: 'Test Subject',
			Html: '<h1>Hello</h1>',
			Text: 'Hello',
		},
	}));

	await ses.send(new DeleteEmailTemplateCommand({
		TemplateName: templateName,
	}));

	await expect(axios({
		method: 'get',
		baseURL,
		url: `/v2/email/templates/${templateName}`,
	})).rejects.toThrow();
});

test('returns error when deleting non-existent template', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new DeleteEmailTemplateCommand({
		TemplateName: 'non-existent-template',
	}))).rejects.toThrow();
});

test('returns error when template name is missing', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new DeleteEmailTemplateCommand({
		TemplateName: '',
	}))).rejects.toThrow();
});
