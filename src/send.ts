import { Email } from './store';

const nodemailer = require('nodemailer');
let transporter: any = undefined;

// Initialize the tranporter if its configuration exists.
if (transporter === undefined) {
  const config = process.env.SMTP_TRANSPORT ? JSON.parse(process.env.SMTP_TRANSPORT) : {};
  if (config) {
    transporter = nodemailer.createTransport(config);
  }
  else {
    transporter = false;
  }
}

interface EmailData {
  messageId: string,
  from: string,
  to: string[],
  cc: string[],
  bcc: string[],
  replyTo?: string,
  subject: string,
  html?: string,
  text?: string,
  attachments: { content: string, contentType: string, filename?: string, size: number }[],
}

export function sendEmail(email: Email): void {
  if (!transporter) {
    return;
  }

  const data: EmailData = {
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
    data.replyTo = email.replyTo[0];
  }

  transporter.sendMail(data, function(error: string, info: any) {
    if (error) {
      console.log(error);
    }
  });
};
