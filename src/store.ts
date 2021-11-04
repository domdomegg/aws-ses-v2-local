export interface Store {
    emails: Email[],
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
    at: number,
}

const store: Store = {
  emails: [],
};

export default store;
