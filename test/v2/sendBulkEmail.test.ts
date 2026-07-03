import {test, expect} from 'vitest';
import {SESv2Client, SendBulkEmailCommand, CreateEmailTemplateCommand} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import {type Store} from '../../src/store';
import {baseURL} from '../globals';

test('can send bulk email with template name', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-email-template';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {
			Subject: 'Hello {{name}}!',
			Html: '<h1>Hello {{name}}!</h1><p>Your age is {{age}}</p>',
			Text: 'Hello {{name}}! Your age is {{age}}',
		},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateName: templateName,
				TemplateData: JSON.stringify({name: 'Default', age: '25'}),
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['user1@example.com'],
				},
				ReplacementEmailContent: {
					ReplacementTemplate: {
						ReplacementTemplateData: JSON.stringify({name: 'John', age: '30'}),
					},
				},
			},
			{
				Destination: {
					ToAddresses: ['user2@example.com'],
				},
				ReplacementEmailContent: {
					ReplacementTemplate: {
						ReplacementTemplateData: JSON.stringify({name: 'Jane', age: '28'}),
					},
				},
			},
		],
	}));

	expect(response.BulkEmailEntryResults).toHaveLength(2);
	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;

	expect(s.emails).toHaveLength(2);
	expect(s.emails[0]).toMatchObject({
		subject: 'Hello John!',
		body: {
			html: '<h1>Hello John!</h1><p>Your age is 30</p>',
			text: 'Hello John! Your age is 30',
		},
		destination: {
			to: ['user1@example.com'],
		},
	});
	expect(s.emails[1]).toMatchObject({
		subject: 'Hello Jane!',
		body: {
			html: '<h1>Hello Jane!</h1><p>Your age is 28</p>',
			text: 'Hello Jane! Your age is 28',
		},
		destination: {
			to: ['user2@example.com'],
		},
	});
});

test('can send bulk email with inline template content', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateContent: {
					Subject: 'Welcome {{name}}',
					Html: '<p>Welcome {{name}}!</p>',
					Text: 'Welcome {{name}}!',
				},
				TemplateData: JSON.stringify({name: 'Default User'}),
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['user1@example.com'],
				},
				ReplacementEmailContent: {
					ReplacementTemplate: {
						ReplacementTemplateData: JSON.stringify({name: 'Alice'}),
					},
				},
			},
		],
	}));

	expect(response.BulkEmailEntryResults).toHaveLength(1);
	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;

	const lastEmail = s.emails[s.emails.length - 1];
	expect(lastEmail).toMatchObject({
		subject: 'Welcome Alice',
		body: {
			html: '<p>Welcome Alice!</p>',
			text: 'Welcome Alice!',
		},
		destination: {
			to: ['user1@example.com'],
		},
	});
});

test('returns error when template not found', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateName: 'non-existent-template',
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['user1@example.com'],
				},
			},
		],
	}))).rejects.toThrow();
});

test('returns error when missing from email address', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new SendBulkEmailCommand({
		DefaultContent: {
			Template: {
				TemplateContent: {
					Subject: 'Test',
					Text: 'Test content',
				},
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['user1@example.com'],
				},
			},
		],
	}))).rejects.toThrow();
});

test('handles invalid email addresses in bulk entries', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateContent: {
					Subject: 'Test Subject',
					Text: 'Test content',
				},
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['valid@example.com'],
				},
			},
			{
				Destination: {
					ToAddresses: ['invalid-email'],
				},
			},
		],
	}));

	expect(response.BulkEmailEntryResults).toHaveLength(2);
	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('FAILED');
	expect(response.BulkEmailEntryResults?.[1]?.Error).toBe('Invalid recipient email address(es)');
});

test('handles invalid template data JSON', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateContent: {
					Subject: 'Test {{name}}',
					Text: 'Hello {{name}}',
				},
				TemplateData: 'invalid json',
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['user1@example.com'],
				},
			},
		],
	}))).rejects.toThrow();
});

test('supports multiple destination types (to, cc, bcc)', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		ReplyToAddresses: ['reply@example.com'],
		DefaultContent: {
			Template: {
				TemplateContent: {
					Subject: 'Test Subject',
					Text: 'Test content',
				},
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['to@example.com'],
					CcAddresses: ['cc@example.com'],
					BccAddresses: ['bcc@example.com'],
				},
			},
		],
	}));

	expect(response.BulkEmailEntryResults).toHaveLength(1);
	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;

	const lastEmail = s.emails[s.emails.length - 1];
	expect(lastEmail).toMatchObject({
		destination: {
			to: ['to@example.com'],
			cc: ['cc@example.com'],
			bcc: ['bcc@example.com'],
		},
		replyTo: ['reply@example.com'],
	});
});

test('can send bulk email with whitespace around template variables', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-email-template-whitespace';

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {
			Subject: 'Hello {{ name }}!',
			Html: '<h1>Hello {{name}}!</h1><p>Your age is {{  age  }}</p>',
			Text: 'Hello {{ name}}! Your age is {{age }}',
		},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateName: templateName,
				TemplateData: JSON.stringify({name: 'Default', age: '25'}),
			},
		},
		BulkEmailEntries: [
			{
				Destination: {
					ToAddresses: ['whitespace@example.com'],
				},
				ReplacementEmailContent: {
					ReplacementTemplate: {
						ReplacementTemplateData: JSON.stringify({name: 'John', age: '30'}),
					},
				},
			},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({
		method: 'get',
		baseURL,
		url: '/store',
	})).data;

	const lastEmail = s.emails[s.emails.length - 1];
	expect(lastEmail).toMatchObject({
		subject: 'Hello John!',
		body: {
			html: '<h1>Hello John!</h1><p>Your age is 30</p>',
			text: 'Hello John! Your age is 30',
		},
		destination: {
			to: ['whitespace@example.com'],
		},
	});
});

test('renders per-recipient advanced features and falls back to default data', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-advanced';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {
			Subject: 'Hi {{name}}',
			Html: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
		},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateName: templateName,
				TemplateData: JSON.stringify({name: 'Default', items: []}),
			},
		},
		BulkEmailEntries: [
			{
				Destination: {ToAddresses: ['ann@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({name: 'Ann', items: ['x', 'y']})}},
			},
			{
				Destination: {ToAddresses: ['fallback@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({})}},
			},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({method: 'get', baseURL, url: '/store'})).data;
	expect(s.emails).toContainEqual(expect.objectContaining({
		subject: 'Hi Ann',
		body: expect.objectContaining({html: '<ul><li>x</li><li>y</li></ul>'}),
	}));
	expect(s.emails).toContainEqual(expect.objectContaining({
		subject: 'Hi Default',
		body: expect.objectContaining({html: '<ul></ul>'}),
	}));
});

test('renders missing template variables as empty by default (SES parity)', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-missing-var';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Bye {{name}}'},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {Template: {TemplateName: templateName}},
		BulkEmailEntries: [
			{
				Destination: {ToAddresses: ['ok@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({name: 'Ann'})}},
			},
			{
				Destination: {ToAddresses: ['broken@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({})}},
			},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({method: 'get', baseURL, url: '/store'})).data;
	const brokenEmail = s.emails.find((e) => e.destination.to.includes('broken@example.com'));
	expect(brokenEmail).toMatchObject({subject: 'Hi ', body: {text: 'Bye '}});
});

test('does not merge default data into partial replacement data (whole-object fallback)', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-whole-object-fallback';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Age {{age}}'},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {Template: {TemplateName: templateName, TemplateData: JSON.stringify({name: 'Default', age: '25'})}},
		BulkEmailEntries: [
			{
				Destination: {ToAddresses: ['partial@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({name: 'Ann'})}},
			},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({method: 'get', baseURL, url: '/store'})).data;
	const email = s.emails.find((e) => e.destination.to.includes('partial@example.com'));
	// age exists only in the defaults, so under whole-object fallback it renders empty (not '25').
	expect(email).toMatchObject({subject: 'Hi Ann', body: {text: 'Age '}});
});

test('marks a recipient FAILED when its ReplacementTemplateData is invalid JSON', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-bad-replacement-json';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Bye {{name}}'},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {Template: {TemplateName: templateName, TemplateData: JSON.stringify({name: 'Default'})}},
		BulkEmailEntries: [
			{
				Destination: {ToAddresses: ['ok@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: JSON.stringify({name: 'Ann'})}},
			},
			{
				Destination: {ToAddresses: ['bad@example.com']},
				ReplacementEmailContent: {ReplacementTemplate: {ReplacementTemplateData: 'not json'}},
			},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('FAILED');
	expect(response.BulkEmailEntryResults?.[1]?.Error).toBeTruthy();
});

test('can send bulk email by TemplateArn', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-arn-template';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Order {{orderNumber}}', Text: 'Order {{orderNumber}}'},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateArn: `arn:aws:ses:us-east-1:123456789012:template/${templateName}`,
				TemplateData: JSON.stringify({orderNumber: '42'}),
			},
		},
		BulkEmailEntries: [{Destination: {ToAddresses: ['bulk-arn@example.com']}}],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({method: 'get', baseURL, url: '/store'})).data;
	expect(s.emails).toMatchObject([
		{
			subject: 'Order 42',
			destination: {to: ['bulk-arn@example.com']},
		},
	]);
});

test('applies Template Headers to every bulk email', async () => {
	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const templateName = 'bulk-headers-template';
	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: templateName,
		TemplateContent: {Subject: 'Hi {{name}}', Text: 'Hi {{name}}'},
	}));

	const response = await ses.send(new SendBulkEmailCommand({
		FromEmailAddress: 'sender@example.com',
		DefaultContent: {
			Template: {
				TemplateName: templateName,
				TemplateData: JSON.stringify({name: 'Default'}),
				Headers: [{Name: 'X-Campaign', Value: 'summer-sale'}],
			},
		},
		BulkEmailEntries: [
			{Destination: {ToAddresses: ['bulk-headers-1@example.com']}},
			{Destination: {ToAddresses: ['bulk-headers-2@example.com']}},
		],
	}));

	expect(response.BulkEmailEntryResults?.[0]?.Status).toBe('SUCCESS');
	expect(response.BulkEmailEntryResults?.[1]?.Status).toBe('SUCCESS');

	const s: Store = (await axios({method: 'get', baseURL, url: '/store'})).data;
	expect(s.emails).toHaveLength(2);
	for (const email of s.emails) {
		expect(email.headers).toEqual([{name: 'X-Campaign', value: 'summer-sale'}]);
	}
});
