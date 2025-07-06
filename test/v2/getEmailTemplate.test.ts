import {test, expect} from 'vitest';
import {SESv2Client, GetEmailTemplateCommand, CreateEmailTemplateCommand} from '@aws-sdk/client-sesv2';
import {baseURL} from '../globals';

test('can get existing email template', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'get-template-test';
	const templateContent = {
		Subject: 'Test Subject {{name}}',
		Html: '<h1>Hello {{name}}</h1>',
		Text: 'Hello {{name}}',
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}));

	const response = await ses.send(new GetEmailTemplateCommand({
		TemplateName: templateName,
	}));

	expect(response.TemplateName).toBe(templateName);
	expect(response.TemplateContent).toMatchObject(templateContent);
});

test('returns error when getting non-existent template', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new GetEmailTemplateCommand({
		TemplateName: 'non-existent-template',
	}))).rejects.toThrow();
});

test('returns error when template name is missing', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new GetEmailTemplateCommand({
		TemplateName: '',
	}))).rejects.toThrow();
});

test('can get template with only required fields', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'minimal-template';
	const templateContent = {
		Subject: 'Minimal Subject',
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}));

	const response = await ses.send(new GetEmailTemplateCommand({
		TemplateName: templateName,
	}));

	expect(response.TemplateName).toBe(templateName);
	expect(response.TemplateContent?.Subject).toBe(templateContent.Subject);
});
