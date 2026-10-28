import {
	beforeAll, afterAll, beforeEach, test, expect, vi,
} from 'vitest';
import type {Server} from 'http';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {SESClient, SendRawEmailCommand} from '@aws-sdk/client-ses';
import {SESv2Client, SendEmailCommand} from '@aws-sdk/client-sesv2';
import server from '../src';
import axios from 'axios';
import {getAddress} from '../src/address';
import {clearStore} from '../src/store';

type Delivery = {
	message: Buffer;
	envelope: {from: string | false; to: string[]};
};

let deliveries: Promise<Delivery>[] = [];
const composer = nodemailer.createTransport({streamTransport: true, buffer: true});
// Compile messages as SMTP does, but capture them without opening an SMTP connection.
const captureTransport = nodemailer.createTransport<Delivery>({
	name: 'capture',
	version: '1.0.0',
	send(mail, callback) {
		deliveries.push(new Promise((resolve, reject) => {
			const compiled = mail.message;
			const envelope = compiled.getEnvelope();
			compiled.build((error, message) => {
				if (error) {
					reject(error);
					callback(error);
					return;
				}

				const delivery = {envelope, message};
				resolve(delivery);
				callback(null, delivery);
			});
		}));
	},
});
let localServer: Server;
let v1: SESClient;
let v2: SESv2Client;

beforeAll(async () => {
	vi.stubEnv('SMTP_TRANSPORT', '{}');
	vi.spyOn(nodemailer, 'createTransport').mockReturnValue(captureTransport);
	localServer = await server({port: 0, host: '127.0.0.1'});
	const config = {
		endpoint: getAddress(localServer),
		region: 'aws-ses-v2-local',
		credentials: {accessKeyId: 'ANY_STRING', secretAccessKey: 'ANY_STRING'},
	};
	v1 = new SESClient(config);
	v2 = new SESv2Client(config);
});

beforeEach(() => {
	clearStore();
	deliveries = [];
});

afterAll(async () => {
	v1.destroy();
	v2.destroy();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	await new Promise<void>((resolve, reject) => {
		localServer.close((error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
});

async function submitRaw(version: 'v1' | 'v2', raw: Buffer): Promise<Delivery> {
	if (version === 'v1') {
		await v1.send(new SendRawEmailCommand({RawMessage: {Data: raw}}));
	} else {
		await v2.send(new SendEmailCommand({Content: {Raw: {Data: raw}}}));
	}

	expect(deliveries).toHaveLength(1);
	return deliveries[0]!;
}

async function calendarMessage(method: string) {
	const calendar = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SMTP regression//EN',
		`METHOD:${method}`,
		'BEGIN:VEVENT',
		'UID:calendar@example.test',
		'DTSTAMP:20261020T100000Z',
		'DTSTART:20261101T100000Z',
		'DTEND:20261101T110000Z',
		'ORGANIZER:mailto:organizer@example.test',
		'ATTENDEE:mailto:attendee@example.test',
		'END:VEVENT',
		'END:VCALENDAR',
		'',
	].join('\r\n');
	const composed = await composer.sendMail({
		from: '"Organizer, Example" <organizer@example.test>',
		to: 'Attendee <attendee@example.test>, Other <other@example.test>',
		cc: 'Observer <observer@example.test>',
		replyTo: 'schedule@example.test',
		subject: 'Meeting invitation',
		text: 'Meeting details',
		html: '<p>Meeting details</p>',
		icalEvent: {method, content: calendar},
	});
	if (!Buffer.isBuffer(composed.message)) {
		throw new Error('Expected buffered message');
	}

	return {raw: composed.message, calendar};
}

for (const version of ['v1', 'v2'] as const) {
	for (const method of ['REQUEST', 'CANCEL']) {
		test(`${version} Raw ${method} preserves calendar MIME when forwarded to SMTP`, async () => {
			const {raw, calendar} = await calendarMessage(method);
			const outgoing = await submitRaw(version, raw);
			const parsed = await simpleParser(outgoing.message);

			expect(outgoing.message.equals(raw)).toBe(true);
			expect(parsed.attachments.find((part) => part.contentType === 'text/calendar')?.content.toString()).toBe(calendar);
			expect(parsed.replyTo?.value[0]?.address).toBe('schedule@example.test');
			expect(outgoing.envelope.from).toBe('organizer@example.test');
			expect(outgoing.envelope.to.sort()).toEqual(['attendee@example.test', 'observer@example.test', 'other@example.test']);
		});
	}

	test.each([
		['uppercase', 'BCC: hidden@example.test\r\n', 'first'],
		['lowercase', 'bcc: hidden@example.test\r\n', 'last'],
		['mixed case', 'BcC: hidden@example.test\r\n', 'last'],
		['space-folded', 'Bcc:\r\n hidden@example.test\r\n', 'last'],
		['tab-folded', 'Bcc:\r\n\thidden@example.test\r\n', 'last'],
		['repeated', 'Bcc: hidden@example.test\r\nBCC: hidden@example.test\r\n', 'last'],
	])(`${version} Raw removes %s Bcc headers while retaining hidden recipients`, async (_name, bccHeader, position) => {
		const {raw} = await calendarMessage('REQUEST');
		const insertion = position === 'first' ? 0 : raw.indexOf('\r\n\r\n') + 2;
		const withBcc = Buffer.concat([raw.subarray(0, insertion), Buffer.from(bccHeader), raw.subarray(insertion)]);

		const outgoing = await submitRaw(version, withBcc);

		expect(outgoing.message.equals(raw)).toBe(true);
		expect(outgoing.envelope.to.sort()).toEqual(['attendee@example.test', 'hidden@example.test', 'observer@example.test', 'other@example.test']);
	});

	test.each(['\r\n', '\n'])(`${version} Raw keeps binary MIME body unchanged with %j header line endings`, async (newline) => {
		const headers = ['From: organizer@example.test', 'To: attendee@example.test', 'Subject: Binary content', 'MIME-Version: 1.0', 'Content-Type: application/octet-stream', 'Content-Transfer-Encoding: binary', '', ''].join(newline);
		const body = Buffer.concat([Buffer.from(`Bcc: this is body content${newline}\tbody continuation\r\n\r\n`), Buffer.from([0, 128, 255]), Buffer.from('\r\n')]);
		const raw = Buffer.concat([Buffer.from(headers), body]);
		const withBcc = Buffer.concat([Buffer.from(`Bcc: hidden@example.test${newline}`), raw]);

		const outgoing = await submitRaw(version, withBcc);

		expect(outgoing.message.equals(raw)).toBe(true);
		expect(outgoing.envelope.to).toEqual(['attendee@example.test', 'hidden@example.test']);
	});
}

test('v1 Raw uses Source and Destinations as the SMTP envelope when given', async () => {
	const {raw} = await calendarMessage('REQUEST');
	await v1.send(new SendRawEmailCommand({
		RawMessage: {Data: raw},
		Source: 'bounces@example.test',
		Destinations: ['attendee@example.test', 'hidden@example.test'],
	}));
	const outgoing = await deliveries[0]!;

	expect(outgoing.message.equals(raw)).toBe(true);
	expect(outgoing.envelope.from).toBe('bounces@example.test');
	expect(outgoing.envelope.to).toEqual(['attendee@example.test', 'hidden@example.test']);
});

test('v2 Raw uses FromEmailAddress and Destination as the SMTP envelope when given', async () => {
	const {raw} = await calendarMessage('REQUEST');
	await v2.send(new SendEmailCommand({
		FromEmailAddress: 'bounces@example.test',
		Destination: {ToAddresses: ['attendee@example.test'], BccAddresses: ['hidden@example.test']},
		Content: {Raw: {Data: raw}},
	}));
	const outgoing = await deliveries[0]!;

	expect(outgoing.message.equals(raw)).toBe(true);
	expect(outgoing.envelope.from).toBe('bounces@example.test');
	expect(outgoing.envelope.to).toEqual(['attendee@example.test', 'hidden@example.test']);
});

test('GET /store does not expose the raw MIME message', async () => {
	const {raw} = await calendarMessage('REQUEST');
	await submitRaw('v2', raw);

	const {data} = await axios({method: 'get', baseURL: getAddress(localServer), url: '/store'});
	expect(data.emails).toHaveLength(1);
	expect(data.emails[0]).not.toHaveProperty('raw');
});

test('Simple messages still forward their body, headers and recipients', async () => {
	await v2.send(new SendEmailCommand({
		FromEmailAddress: 'organizer@example.test',
		Destination: {ToAddresses: ['attendee@example.test'], BccAddresses: ['hidden@example.test']},
		ReplyToAddresses: ['schedule@example.test'],
		Content: {
			Simple: {
				Subject: {Data: 'Simple message'},
				Body: {Text: {Data: 'Plain content'}, Html: {Data: '<p>HTML content</p>'}},
				Headers: [{Name: 'X-Test-Header', Value: 'simple'}],
			},
		},
	}));
	const outgoing = await deliveries[0]!;
	const parsed = await simpleParser(outgoing.message);

	expect(parsed.text?.trim()).toBe('Plain content');
	expect(parsed.html).toBe('<p>HTML content</p>');
	expect(parsed.headers.get('x-test-header')).toBe('simple');
	expect(parsed.replyTo?.value[0]?.address).toBe('schedule@example.test');
	expect(parsed.bcc).toBeUndefined();
	expect(outgoing.envelope.to.sort()).toEqual(['attendee@example.test', 'hidden@example.test']);
});

test('Template messages still render before SMTP forwarding', async () => {
	await v2.send(new SendEmailCommand({
		FromEmailAddress: 'organizer@example.test',
		Destination: {ToAddresses: ['attendee@example.test']},
		Content: {
			Template: {
				TemplateContent: {Subject: 'Hello {{name}}', Text: 'Hello {{name}}', Html: '<p>Hello {{name}}</p>'},
				TemplateData: JSON.stringify({name: 'Attendee'}),
			},
		},
	}));
	const outgoing = await deliveries[0]!;
	const parsed = await simpleParser(outgoing.message);

	expect(parsed.subject).toBe('Hello Attendee');
	expect(parsed.text?.trim()).toBe('Hello Attendee');
	expect(parsed.html).toBe('<p>Hello Attendee</p>');
	expect(outgoing.envelope.to).toEqual(['attendee@example.test']);
});
