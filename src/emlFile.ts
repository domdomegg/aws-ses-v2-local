import {createTransport} from 'nodemailer';
import {convertToMailOptions, type Email} from './store';

export type CreateEmlContentResult = {
	messageId: string;
	fileName: string;
	body: Buffer;
};

export const createEmlContent = async (email: Email): Promise<CreateEmlContentResult> => {
	const transporter = createTransport({
		streamTransport: true,
		buffer: true,
	});

	return new Promise((resolve, reject) => {
		transporter.sendMail(convertToMailOptions(email), (error, info) => {
			if (error) {
				reject(error);
			} else if (!Buffer.isBuffer(info.message)) {
				reject(new Error('Expected nodemailer stream transport to return a Buffer'));
			} else {
				resolve({messageId: email.messageId, fileName: email.subject, body: info.message});
			}
		});
	});
};
