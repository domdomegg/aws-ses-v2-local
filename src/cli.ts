#!/usr/bin/env node
/* eslint-disable no-console */

import server from '.';
import { getAddress } from './address';

console.log('aws-ses-v2-local: starting server...');
server()
  .then((s) => {
    console.log(`aws-ses-v2-local: server running at ${getAddress(s)}`);
  })
  .catch((e) => {
    console.log('aws-ses-v2-local: failed to start server');
    console.error(e);
  });
