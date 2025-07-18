import {test, expect} from 'vitest';
import {SESv2Client, CreateEmailTemplateCommand, GetEmailTemplateCommand} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import {baseURL} from '../globals';

test('can create email template with all fields', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'create-template-test-all-fields';
	const templateContent = {
		Subject: 'Test Subject {{name}}',
		Html: '<h1>Hello {{name}}</h1><p>This is a test email.</p>',
		Text: 'Hello {{name}}\n\nThis is a test email.',
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

test('can create email template with only subject', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'create-template-test-subject-only';
	const templateContent = {
		Subject: 'Test Subject Only',
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

test('can create email template with only HTML', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'create-template-test-html-only';
	const templateContent = {
		Html: '<h1>HTML Only Template</h1>',
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}));

	const response = await ses.send(new GetEmailTemplateCommand({
		TemplateName: templateName,
	}));

	expect(response.TemplateName).toBe(templateName);
	expect(response.TemplateContent?.Html).toBe(templateContent.Html);
});

test('can create email template with only text', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'create-template-test-text-only';
	const templateContent = {
		Text: 'Text only template content',
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}));

	const response = await ses.send(new GetEmailTemplateCommand({
		TemplateName: templateName,
	}));

	expect(response.TemplateName).toBe(templateName);
	expect(response.TemplateContent?.Text).toBe(templateContent.Text);
});

test('returns error when creating template that already exists', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'duplicate-template-test';
	const templateContent = {
		Subject: 'Duplicate Test Subject',
		Html: '<h1>Duplicate Test</h1>',
		Text: 'Duplicate Test',
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}));

	await expect(ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: templateContent,
	}))).rejects.toThrow();
});

test('returns error when template name is missing', async () => {
	await expect(axios({
		method: 'post',
		baseURL,
		url: '/v2/email/templates',
		data: {
			TemplateContent: {
				Subject: 'Test Subject',
			},
		},
	})).rejects.toThrow();
});

test('returns error when template content is missing', async () => {
	await expect(axios({
		method: 'post',
		baseURL,
		url: '/v2/email/templates',
		data: {
			TemplateName: 'test-template-no-content',
		},
	})).rejects.toThrow();
});

test('returns error when request body is invalid', async () => {
	await expect(axios({
		method: 'post',
		baseURL,
		url: '/v2/email/templates',
		data: {
			InvalidField: 'invalid-value',
		},
	})).rejects.toThrow();
});

test('returns error when template content is empty object', async () => {
	await expect(axios({
		method: 'post',
		baseURL,
		url: '/v2/email/templates',
		data: {
			TemplateName: 'empty-content-template',
			TemplateContent: {},
		},
	})).rejects.toThrow();
});
