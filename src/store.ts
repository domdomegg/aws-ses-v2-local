import {type MailOptions} from 'nodemailer/lib/sendmail-transport';
import {sendEmailToSmtp} from './smtp';
import z from 'zod';

export type Store = {
	emails: Email[];
	templates: Map<string, Template>;
};

export type Email = {
	messageId: string;
	from: string;
	replyTo: string[];
	destination: {
		to: string[];
		cc: string[];
		bcc: string[];
	};
	subject: string;
	body: {
		html?: string | undefined;
		text?: string | undefined;
	};
	attachments: {content: string; contentType: string; filename?: string | undefined; size: number}[];
	at: number;
};

export const templateSchema = z.object({
	TemplateContent: z.object({
		Html: z.string().optional(),
		Subject: z.string().optional(),
		Text: z.string().optional(),
	}),
	TemplateName: z.string(),
	CreatedTimestamp: z.number().min(0),
});

export type Template = z.infer<typeof templateSchema>;

const store: Store = {
	emails: [],
	templates: new Map(),
};

export const saveEmail = (email: Email) => {
	store.emails.push(email);
	void sendEmailToSmtp(email);
};

export const hasTemplate = (key: string) => store.templates.has(key);
export const getTemplate = (key: string) => store.templates.get(key);
export const setTemplate = (key: string, value: Template) => store.templates.set(key, value);
export const deleteTemplate = (key: string) => store.templates.delete(key);

export const clearStore = () => {
	store.emails = [];
	store.templates.clear();
};

// This type doesn't give us perfect readonly safety
// But this is probably safe enough for now, given the method name
// and the relatively small project size.
export const getStoreReadonly = (): Readonly<Store> => store;

export const convertToMailOptions = (email: Email): MailOptions => ({
	from: email.from,
	replyTo: email.replyTo,
	to: email.destination.to,
	cc: email.destination.cc,
	bcc: email.destination.bcc,
	subject: email.subject,
	html: email.body.html,
	text: email.body.text,
	attachments: email.attachments,
	date: new Date(email.at * 1000),
});
