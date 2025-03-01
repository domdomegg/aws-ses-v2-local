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

	try {
		await transporter.sendMail(data);
	} catch (err) {
		console.error('Failed to send mail to SMTP server', err);
	}
}
