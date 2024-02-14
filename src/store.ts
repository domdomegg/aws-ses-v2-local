import { sendEmailToSmtp } from './smtp';

export interface Store {
  emails: Email[],
  templates: Map<string, Template>,
}

export interface Email {
  messageId: string,
  from: string,
  replyTo: string[],
  destination: {
    to: string[],
    cc: string[],
    bcc: string[],
  },
  subject: string,
  body: {
    html?: string,
    text?: string,
  },
  attachments: { content: string, contentType: string, filename?: string, size: number }[]
  at: number,
}

export interface Template {
  TemplateContent: {
    Html: string,
    Subject: string,
    Text: string,
  },
  TemplateName: string,
}

const store: Store = {
  emails: [],
  templates: new Map(),
};

export const saveEmail = (email: Email) => {
  store.emails.push(email);
  sendEmailToSmtp(email);
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
