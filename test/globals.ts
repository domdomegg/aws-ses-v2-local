/* eslint-disable no-underscore-dangle */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
import type { Server } from 'http';

declare global {
  var __AWS_SES_V2_LOCAL_SERVER: Server;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const baseURL: string = process.env.__AWS_SES_V2_LOCAL_BASEURL!;
