#!/usr/bin/env node
/* eslint-disable no-console */

import server from '.';

console.log('aws-ses-v2-local: starting server...');
server()
  .then((s) => {
    let address = s.address();
    if (address && typeof address !== 'string') {
      if (address.address === '127.0.0.1' || address.address === '::') {
        address = `http://localhost:${address.port}`;
      } else if (address.family === 'IPv4') {
        address = `http://${address.address}:${address.port}`;
      } else if (address.family === 'IPv6') {
        address = `http://[${address.address}]:${address.port}`;
      } else {
        address = `${address.address}:${address.port}`;
      }
    }

    console.log(`aws-ses-v2-local: server running${address ? ` at ${address}` : ''}`);
  })
  .catch((e) => {
    console.log('aws-ses-v2-local: failed to start server');
    console.error(e);
  });
