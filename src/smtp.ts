import nodemailer, {type Transporter, type SendMailOptions} from 'nodemailer';
import {type Email} from './store';

let transporter: Transporter;

export async function sendEmailToSmtp(email: Email): Promise<void> {
	if (!process.env.SMTP_TRANSPORT?.trim()) {
		return;
	}

	if (!transporter) {
		const config = JSON.parse(process.env.SMTP_TRANSPORT);
		transporter = nodemailer.createTransport(config);
	}

	const data: SendMailOptions = {
		messageId: email.messageId,
		from: email.from,
		to: email.destination.to,
		cc: email.destination.cc,
		bcc: email.destination.bcc,
		subject: email.subject,
		attachments: email.attachments,
	};
	if (email.body?.html) {
		data.html = email.body.html;
	}

	if (email.body?.text) {
		data.text = email.body.text;
	}

	if (email.replyTo.length > 0) {
		data.replyTo = email.replyTo;
	}

	if (email.headers && email.headers.length > 0) {
		data.headers = email.headers.map((h) => ({key: h.name, value: h.value}));
	}

	if (email.raw) {
		const raw = Buffer.from(email.raw, 'base64');
		const separator = /(\r?\n)\r?\n/.exec(raw.toString('latin1'));
		const headerLength = separator === null ? raw.length : separator.index + separator[1]!.length;
		// Bcc recipients belong in the envelope; preserve the remaining MIME bytes.
		const headers = raw.subarray(0, headerLength).toString('latin1')
			.replace(/^Bcc:[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*(?:\r?\n|$)/gim, '');
		data.raw = Buffer.concat([Buffer.from(headers, 'latin1'), raw.subarray(headerLength)]);
		data.envelope = {
			from: email.from,
			to: [...email.destination.to, ...email.destination.cc, ...email.destination.bcc],
		};
	}

	try {
		await transporter.sendMail(data);
	} catch (err) {
		console.error('Failed to send mail to SMTP server', err);
	}
}
