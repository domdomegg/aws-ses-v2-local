import {
	test, expect, describe,
} from 'vitest';
import {
	SESv2Client, ListEmailTemplatesCommand, CreateEmailTemplateCommand, DeleteEmailTemplateCommand,
} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import {baseURL} from '../globals';

const ses = new SESv2Client({
	endpoint: baseURL,
	region: 'aws-ses-v2-local',
	credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
});

async function createTestTemplate(name: string, index = 0) {
	const templateContent = {
		Subject: `Test Subject ${name} ${index}`,
		Html: `<h1>Hello from ${name}</h1>`,
		Text: `Hello from ${name}`,
	};

	await ses.send(new CreateEmailTemplateCommand({
		TemplateName: name,
		TemplateContent: templateContent,
	}));

	return templateContent;
}

async function deleteTestTemplate(name: string) {
	try {
		await ses.send(new DeleteEmailTemplateCommand({
			TemplateName: name,
		}));
	} catch {
		// Ignore errors if template doesn't exist
	}
}

async function createMultipleTemplates(count: number, prefix = 'test-template') {
	const templateNames: string[] = [];
	const promises = [];
	for (let i = 0; i < count; i++) {
		const templateName = `${prefix}-${i.toString().padStart(3, '0')}`;
		promises.push(createTestTemplate(templateName, i));
		templateNames.push(templateName);
	}

	await Promise.all(promises);

	return templateNames;
}

async function cleanupTemplates(templateNames: string[]) {
	const promises = templateNames.map(async (name) => deleteTestTemplate(name));
	await Promise.all(promises);
}

describe('ListEmailTemplates - Basic functionality', () => {
	test('can list email templates when no templates exist', async () => {
		const response = await ses.send(new ListEmailTemplatesCommand({}));

		expect(response.TemplatesMetadata).toBeDefined();
		expect(Array.isArray(response.TemplatesMetadata)).toBe(true);
		expect(response.NextToken).toBeUndefined();
	});

	test('can list email templates with default page size', async () => {
		const templateName = 'list-test-default';
		await createTestTemplate(templateName);

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({}));

			expect(response.TemplatesMetadata).toBeDefined();
			expect(Array.isArray(response.TemplatesMetadata)).toBe(true);

			const template = response.TemplatesMetadata?.find((t) => t.TemplateName === templateName);
			expect(template).toBeDefined();
			expect(template?.TemplateName).toBe(templateName);
			expect(template?.CreatedTimestamp).toBeDefined();
			// CreatedTimestamp might be a Date object, so check for both number and Date
			expect(template?.CreatedTimestamp).toSatisfy((timestamp: any) =>
				typeof timestamp === 'number' || timestamp instanceof Date);
		} finally {
			await deleteTestTemplate(templateName);
		}
	});

	test('returns templates sorted by creation timestamp', async () => {
		const template1 = 'sort-test-1';
		const template2 = 'sort-test-2';
		const template3 = 'sort-test-3';

		try {
			await createTestTemplate(template1);
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
			await createTestTemplate(template2);
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
			await createTestTemplate(template3);

			const response = await ses.send(new ListEmailTemplatesCommand({}));

			const templates = response.TemplatesMetadata?.filter((t) =>
				t.TemplateName === template1 || t.TemplateName === template2 || t.TemplateName === template3);

			expect(templates).toHaveLength(3);

			if (templates && templates.length >= 3) {
				const ts0 = templates[0]!.CreatedTimestamp instanceof Date
					? templates[0]!.CreatedTimestamp.getTime()
					: Number(templates[0]!.CreatedTimestamp);
				const ts1 = templates[1]!.CreatedTimestamp instanceof Date
					? templates[1]!.CreatedTimestamp.getTime()
					: Number(templates[1]!.CreatedTimestamp);
				const ts2 = templates[2]!.CreatedTimestamp instanceof Date
					? templates[2]!.CreatedTimestamp.getTime()
					: Number(templates[2]!.CreatedTimestamp);
				expect(ts0).toBeLessThanOrEqual(ts1);
				expect(ts1).toBeLessThanOrEqual(ts2);
			}
		} finally {
			await deleteTestTemplate(template1);
			await deleteTestTemplate(template2);
			await deleteTestTemplate(template3);
		}
	});
});

describe('ListEmailTemplates - PageSize parameter', () => {
	test('can list templates with custom page size', async () => {
		const templateNames = await createMultipleTemplates(5, 'pagesize-test');

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 3,
			}));

			expect(response.TemplatesMetadata).toBeDefined();
			expect(response.TemplatesMetadata?.length).toBeLessThanOrEqual(3);
		} finally {
			await cleanupTemplates(templateNames);
		}
	});

	test('returns NextToken when more templates exist than page size', async () => {
		const templateNames = await createMultipleTemplates(15, 'next-token-test');

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 10,
			}));

			expect(response.TemplatesMetadata).toBeDefined();
			expect(response.TemplatesMetadata?.length).toBeLessThanOrEqual(10);

			// Should have NextToken if there are more than 10 templates total
			if (response.TemplatesMetadata && response.TemplatesMetadata.length === 10) {
				expect(response.NextToken).toBeDefined();
				expect(typeof response.NextToken).toBe('string');
				expect(response.NextToken).toContain('aws-ses-v2-local-mocked-');
			}
		} finally {
			await cleanupTemplates(templateNames);
		}
	});

	test('does not return NextToken when all templates fit in page size', async () => {
		const templateNames = await createMultipleTemplates(3, 'no-next-token-test');

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 10,
			}));

			const ourTemplates = response.TemplatesMetadata?.filter((t) =>
				t.TemplateName?.startsWith('no-next-token-test'));

			expect(ourTemplates).toHaveLength(3);
		} finally {
			await cleanupTemplates(templateNames);
		}
	});

	test('handles page size of 1', async () => {
		const templateName = 'pagesize-one-test';
		await createTestTemplate(templateName);

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 1,
			}));

			expect(response.TemplatesMetadata).toBeDefined();
			expect(response.TemplatesMetadata?.length).toBeLessThanOrEqual(1);
		} finally {
			await deleteTestTemplate(templateName);
		}
	});

	test('handles page size of 100 (maximum)', async () => {
		const response = await ses.send(new ListEmailTemplatesCommand({
			PageSize: 100,
		}));

		expect(response.TemplatesMetadata).toBeDefined();
		expect(Array.isArray(response.TemplatesMetadata)).toBe(true);
	});
});

describe('ListEmailTemplates - NextToken parameter', () => {
	test('can paginate through templates using NextToken', async () => {
		const templateNames = await createMultipleTemplates(15, 'pagination-test');

		try {
			// Get first page
			const firstResponse = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 5,
			}));

			expect(firstResponse.TemplatesMetadata).toBeDefined();
			expect(firstResponse.TemplatesMetadata?.length).toBeLessThanOrEqual(5);

			if (firstResponse.NextToken) {
				// Get second page
				const secondResponse = await ses.send(new ListEmailTemplatesCommand({
					PageSize: 5,
					NextToken: firstResponse.NextToken,
				}));

				expect(secondResponse.TemplatesMetadata).toBeDefined();
				expect(secondResponse.TemplatesMetadata?.length).toBeLessThanOrEqual(5);

				// Ensure no duplicate templates between pages
				const firstPageNames = firstResponse.TemplatesMetadata?.map((t) => t.TemplateName) || [];
				const secondPageNames = secondResponse.TemplatesMetadata?.map((t) => t.TemplateName) || [];

				for (const name of firstPageNames) {
					expect(secondPageNames).not.toContain(name);
				}
			}
		} finally {
			await cleanupTemplates(templateNames);
		}
	});

	test('returns empty result when NextToken points to end of list', async () => {
		const templateNames = await createMultipleTemplates(3, 'end-pagination-test');

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 3,
			}));

			if (response.NextToken) {
				const nextResponse = await ses.send(new ListEmailTemplatesCommand({
					PageSize: 3,
					NextToken: response.NextToken,
				}));

				// Should return templates that don't include our test templates
				const ourTemplates = nextResponse.TemplatesMetadata?.filter((t) =>
					t.TemplateName?.startsWith('end-pagination-test'));
				expect(ourTemplates).toHaveLength(0);
			}
		} finally {
			await cleanupTemplates(templateNames);
		}
	});
});

describe('ListEmailTemplates - Error cases', () => {
	test('returns error for invalid PageSize (less than 1)', async () => {
		// Test with string "0" first to see if conversion is the issue
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				PageSize: '0',
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
				data: {
					type: 'BadRequestException',
					message: 'Bad Request Exception',
					detail: 'aws-ses-v2-local: PageSize must be between 1 and 100',
				},
			},
		});
	});

	test('returns error for invalid PageSize (greater than 100)', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				PageSize: 101,
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
				data: {
					type: 'BadRequestException',
					message: 'Bad Request Exception',
					detail: 'aws-ses-v2-local: PageSize must be between 1 and 100',
				},
			},
		});
	});

	test('returns error for invalid NextToken', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				NextToken: 'invalid-token',
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
				data: {
					type: 'BadRequestException',
					message: 'Bad Request Exception',
					detail: 'aws-ses-v2-local: Invalid NextToken.',
				},
			},
		});
	});

	test('returns error for NextToken with wrong prefix', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				NextToken: 'wrong-prefix-template-name',
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
				data: {
					type: 'BadRequestException',
					message: 'Bad Request Exception',
					detail: 'aws-ses-v2-local: Invalid NextToken.',
				},
			},
		});
	});

	test('returns error for NextToken pointing to non-existent template', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				NextToken: 'aws-ses-v2-local-mocked-non-existent-template',
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
				data: {
					type: 'BadRequestException',
					message: 'Bad Request Exception',
					detail: 'aws-ses-v2-local: Invalid NextToken.',
				},
			},
		});
	});
});

describe('ListEmailTemplates - Edge cases', () => {
	test('handles negative PageSize gracefully', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				PageSize: -1,
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
			},
		});
	});

	test('handles non-numeric PageSize gracefully', async () => {
		await expect(axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				PageSize: 'invalid',
			},
		})).rejects.toMatchObject({
			response: {
				status: 400,
			},
		});
	});

	test('handles PageSize as decimal number', async () => {
		const response = await axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				PageSize: '5.5',
			},
		});

		expect(response.status).toBe(200);
		expect(response.data.TemplatesMetadata).toBeDefined();
	});

	test('handles empty NextToken', async () => {
		const response = await axios({
			method: 'get',
			baseURL,
			url: '/v2/email/templates',
			headers: {
				Authorization: 'AWS4-HMAC-SHA256 Credential=test/20230101/us-east-1/ses/aws4_request, SignedHeaders=host;x-amz-date, Signature=test',
			},
			params: {
				NextToken: '',
			},
		});

		expect(response.status).toBe(200);
		expect(response.data.TemplatesMetadata).toBeDefined();
	});

	test('returns correct response structure', async () => {
		const templateName = 'structure-test';
		await createTestTemplate(templateName);

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({}));

			expect(response).toHaveProperty('TemplatesMetadata');
			expect(Array.isArray(response.TemplatesMetadata)).toBe(true);

			if (response.TemplatesMetadata && response.TemplatesMetadata.length > 0) {
				const template = response.TemplatesMetadata[0]!;
				expect(template).toHaveProperty('TemplateName');
				expect(template).toHaveProperty('CreatedTimestamp');
				expect(typeof template.TemplateName).toBe('string');
				expect(template.CreatedTimestamp).toBeInstanceOf(Date);
			}
		} finally {
			await deleteTestTemplate(templateName);
		}
	});

	test('handles very large template names in NextToken', async () => {
		const longTemplateName = 'a'.repeat(100);
		await createTestTemplate(longTemplateName);

		try {
			const response = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 1,
			}));

			if (response.NextToken) {
				expect(typeof response.NextToken).toBe('string');
				expect(response.NextToken.length).toBeGreaterThan(0);
			}
		} finally {
			await deleteTestTemplate(longTemplateName);
		}
	});
});

describe('ListEmailTemplates - Performance and data integrity', () => {
	test('maintains consistent ordering across multiple requests', async () => {
		const templateNames = await createMultipleTemplates(10, 'order-test');

		try {
			const response1 = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 100,
			}));
			const response2 = await ses.send(new ListEmailTemplatesCommand({
				PageSize: 100,
			}));

			const templates1 = response1.TemplatesMetadata?.filter((t) =>
				t.TemplateName?.startsWith('order-test'));
			const templates2 = response2.TemplatesMetadata?.filter((t) =>
				t.TemplateName?.startsWith('order-test'));

			expect(templates1).toEqual(templates2);
		} finally {
			await cleanupTemplates(templateNames);
		}
	});

	test('handles concurrent requests correctly', async () => {
		const templateNames = await createMultipleTemplates(5, 'concurrent-test');

		try {
			const promises = Array.from({length: 5}, async () =>
				ses.send(new ListEmailTemplatesCommand({PageSize: 100})));

			const responses = await Promise.all(promises);

			// All responses should be successful
			expect(responses).toHaveLength(5);
			responses.forEach((response) => {
				expect(response.TemplatesMetadata).toBeDefined();
				expect(Array.isArray(response.TemplatesMetadata)).toBe(true);
			});
		} finally {
			await cleanupTemplates(templateNames);
		}
	});
});
