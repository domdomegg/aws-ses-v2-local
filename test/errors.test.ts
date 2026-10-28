import {test, expect} from 'vitest';
import {SESClient, SendEmailCommand as V1SendEmailCommand, VerifyEmailIdentityCommand} from '@aws-sdk/client-ses';
import {
	SESv2Client, SendEmailCommand, GetEmailTemplateCommand, BadRequestException, NotFoundException, CreateContactListCommand,
} from '@aws-sdk/client-sesv2';
import {baseURL} from './globals';

const config = {
	endpoint: baseURL,
	region: 'aws-ses-v2-local',
	credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
};

test('v2 errors are surfaced by the SDK with their name and message', async () => {
	const ses = new SESv2Client(config);

	const badRequest = ses.send(new SendEmailCommand({
		FromEmailAddress: 'sender@example.com',
		Destination: {ToAddresses: ['receiver@example.com']},
		Content: {Simple: {Subject: {Data: ''}, Body: {Text: {Data: 'Body'}}}},
	}));
	await expect(badRequest).rejects.toBeInstanceOf(BadRequestException);
	await expect(badRequest).rejects.toMatchObject({
		name: 'BadRequestException',
		message: 'aws-ses-v2-local: Simple content must have a subject.',
		$metadata: {httpStatusCode: 400},
	});

	const notFound = ses.send(new GetEmailTemplateCommand({TemplateName: 'does-not-exist'}));
	await expect(notFound).rejects.toBeInstanceOf(NotFoundException);
	await expect(notFound).rejects.toMatchObject({$metadata: {httpStatusCode: 404}});
});

test('v2 unsupported operations return UnknownOperationException', async () => {
	const ses = new SESv2Client(config);

	await expect(ses.send(new CreateContactListCommand({ContactListName: 'list'}))).rejects.toMatchObject({
		name: 'UnknownOperationException',
		$metadata: {httpStatusCode: 404},
	});
});

test('v1 errors are surfaced by the SDK with their code and message', async () => {
	const ses = new SESClient(config);

	await expect(ses.send(new V1SendEmailCommand({
		Source: 'sender@example.com',
		Destination: {ToAddresses: ['receiver@example.com']},
		Message: {Subject: {Data: 'Subject'}, Body: {}},
	}))).rejects.toMatchObject({
		name: 'InvalidParameterValue',
		message: 'aws-ses-v2-local: Must have either a HTML or Text body.',
		$metadata: {httpStatusCode: 400},
	});
});

test('v1 unsupported actions return InvalidAction rather than hanging', async () => {
	const ses = new SESClient(config);

	await expect(ses.send(new VerifyEmailIdentityCommand({EmailAddress: 'sender@example.com'}))).rejects.toMatchObject({
		name: 'InvalidAction',
		$metadata: {httpStatusCode: 400},
	});
});
