import { createTransport, Transporter } from "nodemailer";
import { convertToMailOptions, Email } from "./store";

export interface CreateEmlContentResult {
  messageId: string,
  error?: string,
  fileName: string,
  body: string
}

export const createEmlContent = async (email: Email): Promise<CreateEmlContentResult> => {

  const transporter: Transporter = createTransport({
    streamTransport: true,
    buffer: true,
  });

  return new Promise((resolve, reject) => {
    transporter.sendMail(convertToMailOptions(email), (error, info) => {
      if (!error) {
        resolve({ messageId: email.messageId, fileName: email.subject, body: info.message });
      } else {
        reject({ messageId: email.messageId, error: `failed to create eml file content, ${error.message}` });
      }
    });
  })
};
