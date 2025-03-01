import {createTransport, type Transporter} from 'nodemailer';
import {convertToMailOptions, type Email} from './store';

export type CreateEmlContentResult = {
	messageId: string;
	fileName: string;
	body: Buffer;
};

export const createEmlContent = async (email: Email): Promise<CreateEmlContentResult> => {
	const transporter: Transporter = createTransport({
		streamTransport: true,
		buffer: true,
	});

	return new Promise((resolve, reject) => {
		transporter.sendMail(convertToMailOptions(email), (error, info) => {
			if (error) {
				reject(error);
			} else {
				resolve({messageId: email.messageId, fileName: email.subject, body: info.message});
			}
		});
	});
};
