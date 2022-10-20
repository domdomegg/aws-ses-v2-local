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

export default store;
