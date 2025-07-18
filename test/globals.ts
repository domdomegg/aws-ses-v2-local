
import type {Server} from 'http';

declare global {
	// eslint-disable-next-line no-var
	var __AWS_SES_V2_LOCAL_SERVER: Server;
}

export const baseURL: string = process.env.__AWS_SES_V2_LOCAL_BASEURL!;
