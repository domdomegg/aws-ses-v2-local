import { createTransport, Transporter } from 'nodemailer';
import { Buffer } from 'buffer';
import { convertToMailOptions, Email } from './store';

export interface CreateEmlContentResult {
  messageId: string,
  fileName: string,
  body: Buffer
}

export const createEmlContent = async (email: Email): Promise<CreateEmlContentResult | Error> => {
  const transporter: Transporter = createTransport({
    streamTransport: true,
    buffer: true,
  });

  return new Promise((resolve, reject) => {
    transporter.sendMail(convertToMailOptions(email), (error, info) => {
      if (!error) {
        resolve({ messageId: email.messageId, fileName: email.subject, body: info.message });
      } else {
        reject(error);
      }
    });
  });
};
