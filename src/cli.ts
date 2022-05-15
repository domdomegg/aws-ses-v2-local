#!/usr/bin/env node
/* eslint-disable no-console */

import makeServer from '.';

console.log('aws-ses-v2-local: starting server...');
makeServer()
  .then(() => {
    console.log('aws-ses-v2-local: server up and running');
  })
  .catch((e) => {
    console.log('aws-ses-v2-local: failed to start server');
    console.error(e);
  });
