
import type {Server} from 'http';

declare global {
	var __AWS_SES_V2_LOCAL_SERVER: Server;
}

export const baseURL: string = process.env.__AWS_SES_V2_LOCAL_BASEURL!;
