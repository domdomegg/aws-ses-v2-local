import {test, expect} from 'vitest';
import {
	SESv2Client, CreateEmailTemplateCommand, UpdateEmailTemplateCommand, GetEmailTemplateCommand,
} from '@aws-sdk/client-sesv2';
import {baseURL} from '../globals';

const client = () => new SESv2Client({
	endpoint: baseURL,
	region: 'aws-ses-v2-local',
	credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
});

test('updates an existing template', async () => {
	const ses = client();
	const templateName = 'update-template-test';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Old {{name}}', Html: '<p>Old {{name}}</p>', Text: 'Old {{name}}'},
	}));

	await ses.send(new UpdateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'New {{name}}', Html: '<p>New {{name}}</p>', Text: 'New {{name}}'},
	}));

	const response = await ses.send(new GetEmailTemplateCommand({TemplateName: templateName}));
	expect(response.TemplateName).toBe(templateName);
	expect(response.TemplateContent).toMatchObject({
		Subject: 'New {{name}}',
		Html: '<p>New {{name}}</p>',
		Text: 'New {{name}}',
	});
});

test('returns 404 when updating a template that does not exist', async () => {
	const ses = client();
	await expect(ses.send(new UpdateEmailTemplateCommand({
		TemplateName: 'does-not-exist',
		TemplateContent: {Subject: 'Hi', Text: 'Hi'},
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 404}});
});

test('rejects an update with malformed Handlebars syntax', async () => {
	const ses = client();
	const templateName = 'update-template-malformed';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi', Text: 'Hi'},
	}));

	await expect(ses.send(new UpdateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi', Html: '{{#if x}}unclosed'},
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 400}});
});
