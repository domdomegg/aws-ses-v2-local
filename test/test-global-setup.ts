/* eslint-disable no-underscore-dangle */
import server from '../src';
import { getAddress } from '../src/address';
import './globals';

export default async () => {
  const s = await server({ port: 7002, host: '0.0.0.0' });
  global.__AWS_SES_V2_LOCAL_SERVER = s;

  const baseURL = getAddress(s);
  process.env.__AWS_SES_V2_LOCAL_BASEURL = baseURL;
};
