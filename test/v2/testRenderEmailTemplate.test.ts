import {test, expect} from 'vitest';
import {
	SESv2Client, CreateEmailTemplateCommand, TestRenderEmailTemplateCommand,
} from '@aws-sdk/client-sesv2';
import {baseURL} from '../globals';

const client = () => new SESv2Client({
	endpoint: baseURL,
	region: 'aws-ses-v2-local',
	credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
});

test('renders a stored template to a MIME message', async () => {
	const ses = client();
	const templateName = 'render-template-test';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {
			Subject: 'Hello {{name}}',
			Html: '<h1>Hi {{name}}</h1>',
			Text: 'Hi {{name}}',
		},
	}));

	const response = await ses.send(new TestRenderEmailTemplateCommand({
		TemplateName: templateName,
		TemplateData: JSON.stringify({name: 'Ada'}),
	}));

	const mime = response.RenderedTemplate ?? '';
	expect(mime).toContain('Subject: Hello Ada');
	expect(mime).toContain('<h1>Hi Ada</h1>');
	expect(mime).toContain('Hi Ada');
	expect(mime).toContain('Content-Type: multipart/alternative');
});

test('returns 404 when rendering a template that does not exist', async () => {
	const ses = client();
	await expect(ses.send(new TestRenderEmailTemplateCommand({
		TemplateName: 'no-such-template',
		TemplateData: '{}',
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 404}});
});

test('rejects a render when TemplateData is not valid JSON', async () => {
	const ses = client();
	const templateName = 'render-template-bad-json';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Hi {{name}}'},
	}));

	await expect(ses.send(new TestRenderEmailTemplateCommand({
		TemplateName: templateName,
		TemplateData: 'not json',
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 400}});
});

test('fails the render when data is missing template attributes (SES parity)', async () => {
	const ses = client();
	const templateName = 'render-template-missing-attr';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Hi {{name}}'},
	}));

	await expect(ses.send(new TestRenderEmailTemplateCommand({
		TemplateName: templateName,
		TemplateData: JSON.stringify({}),
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 400}});
});

test('rejects a render without TemplateData (required in the real API)', async () => {
	const ses = client();
	const templateName = 'render-template-no-data';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi', Text: 'Hi'},
	}));

	await expect(ses.send(new TestRenderEmailTemplateCommand({
		TemplateName: templateName,
		TemplateData: undefined,
	}))).rejects.toMatchObject({$metadata: {httpStatusCode: 400}});
});
