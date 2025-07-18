import type {Server} from 'http';
import {
	test, expect, vi, afterEach,
} from 'vitest';
import {SESv2Client, GetAccountCommand} from '@aws-sdk/client-sesv2';
import axios from 'axios';
import server from '../../src';
import {getAddress} from '../../src/address';

let testServer: Server | null = null;
let testBaseURL: string;

afterEach(async () => {
	if (testServer) {
		await new Promise<void>((resolve, reject) => {
			testServer!.close((err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
		testServer = null;
	}
});

async function startTestServer() {
	testServer = await server({port: 0, host: '127.0.0.1'});
	testBaseURL = getAddress(testServer);
	return testBaseURL;
}

test('can get account information when AWS_SES_ACCOUNT is set', async () => {
	const mockAccount = {
		DedicatedIpAutoWarmupEnabled: true,
		Details: {
			AdditionalContactEmailAddresses: ['contact@example.com'],
			ContactLanguage: 'EN',
			MailType: 'MARKETING',
			ReviewDetails: {
				CaseId: 'case-123',
				Status: 'GRANTED',
			},
			UseCaseDescription: 'Marketing emails for our company',
			WebsiteURL: 'https://example.com',
		},
		EnforcementStatus: 'HEALTHY',
		ProductionAccessEnabled: true,
		SendingEnabled: true,
		SendQuota: {
			Max24HourSend: 1000,
			MaxSendRate: 10,
			SentLast24Hours: 50,
		},
		SuppressionAttributes: {
			SuppressedReasons: ['BOUNCE', 'COMPLAINT'],
		},
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(mockAccount));

	const baseURL = await startTestServer();

	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new GetAccountCommand({}));

	expect(response).toMatchObject(mockAccount);
});

test('can get account information with minimal valid data', async () => {
	const mockAccount = {
		DedicatedIpAutoWarmupEnabled: false,
		Details: {
			AdditionalContactEmailAddresses: [],
			ContactLanguage: 'EN',
			MailType: 'TRANSACTIONAL',
			ReviewDetails: {
				CaseId: '',
				Status: 'PENDING',
			},
			UseCaseDescription: 'Transactional emails',
			WebsiteURL: '',
		},
		EnforcementStatus: 'UNDER_REVIEW',
		ProductionAccessEnabled: false,
		SendingEnabled: false,
		SendQuota: {
			Max24HourSend: 0,
			MaxSendRate: 0,
			SentLast24Hours: 0,
		},
		SuppressionAttributes: {
			SuppressedReasons: [],
		},
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(mockAccount));

	const baseURL = await startTestServer();

	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new GetAccountCommand({}));

	expect(response).toMatchObject(mockAccount);
});

test('returns error when AWS_SES_ACCOUNT is not set', async () => {
	vi.stubEnv('AWS_SES_ACCOUNT', undefined);

	const baseURL = await startTestServer();

	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	await expect(ses.send(new GetAccountCommand({}))).rejects.toThrow();
});

test('returns error when AWS_SES_ACCOUNT contains invalid JSON', async () => {
	vi.stubEnv('AWS_SES_ACCOUNT', 'invalid-json');

	const baseURL = await startTestServer();

	await expect(axios({
		method: 'get',
		baseURL,
		url: '/v2/account',
	})).rejects.toThrow();
});

test('returns error when AWS_SES_ACCOUNT has invalid schema - missing required fields', async () => {
	const invalidAccount = {
		DedicatedIpAutoWarmupEnabled: true,
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(invalidAccount));

	const baseURL = await startTestServer();

	await expect(axios({
		method: 'get',
		baseURL,
		url: '/v2/account',
	})).rejects.toThrow();
});

test('returns error when AWS_SES_ACCOUNT has invalid schema - wrong data types', async () => {
	const invalidAccount = {
		DedicatedIpAutoWarmupEnabled: 'not-a-boolean',
		Details: {
			AdditionalContactEmailAddresses: 'not-an-array',
			ContactLanguage: 123,
			MailType: 'MARKETING',
			ReviewDetails: {
				CaseId: 'case-123',
				Status: 'GRANTED',
			},
			UseCaseDescription: 'Test description',
			WebsiteURL: 'https://example.com',
		},
		EnforcementStatus: 'HEALTHY',
		ProductionAccessEnabled: true,
		SendingEnabled: true,
		SendQuota: {
			Max24HourSend: 'not-a-number',
			MaxSendRate: 10,
			SentLast24Hours: 50,
		},
		SuppressionAttributes: {
			SuppressedReasons: ['BOUNCE', 'COMPLAINT'],
		},
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(invalidAccount));

	const baseURL = await startTestServer();

	await expect(axios({
		method: 'get',
		baseURL,
		url: '/v2/account',
	})).rejects.toThrow();
});

test('returns error when AWS_SES_ACCOUNT has invalid nested object structure', async () => {
	const invalidAccount = {
		DedicatedIpAutoWarmupEnabled: true,
		Details: {
			AdditionalContactEmailAddresses: ['contact@example.com'],
			ContactLanguage: 'EN',
			MailType: 'MARKETING',
			ReviewDetails: 'not-an-object',
			UseCaseDescription: 'Test description',
			WebsiteURL: 'https://example.com',
		},
		EnforcementStatus: 'HEALTHY',
		ProductionAccessEnabled: true,
		SendingEnabled: true,
		SendQuota: {
			Max24HourSend: 1000,
			MaxSendRate: 10,
			SentLast24Hours: 50,
		},
		SuppressionAttributes: {
			SuppressedReasons: ['BOUNCE', 'COMPLAINT'],
		},
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(invalidAccount));

	const baseURL = await startTestServer();

	await expect(axios({
		method: 'get',
		baseURL,
		url: '/v2/account',
	})).rejects.toThrow();
});

test('can handle account with empty string values', async () => {
	const mockAccount = {
		DedicatedIpAutoWarmupEnabled: false,
		Details: {
			AdditionalContactEmailAddresses: [],
			ContactLanguage: '',
			MailType: '',
			ReviewDetails: {
				CaseId: '',
				Status: '',
			},
			UseCaseDescription: '',
			WebsiteURL: '',
		},
		EnforcementStatus: '',
		ProductionAccessEnabled: false,
		SendingEnabled: false,
		SendQuota: {
			Max24HourSend: 0,
			MaxSendRate: 0,
			SentLast24Hours: 0,
		},
		SuppressionAttributes: {
			SuppressedReasons: [],
		},
	};

	vi.stubEnv('AWS_SES_ACCOUNT', JSON.stringify(mockAccount));

	const baseURL = await startTestServer();

	const ses = new SESv2Client({
		endpoint: baseURL,
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	});

	const response = await ses.send(new GetAccountCommand({}));

	expect(response).toMatchObject(mockAccount);
});
