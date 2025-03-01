#!/usr/bin/env node

import {argv} from 'yargs';
import server, {type Config} from '.';
import {getAddress} from './address';

// Parse the command line optional host and port arguments.

const config: Partial<Config> = {};

if (argv instanceof Promise) {
	throw new Error('Expected argv to be an object, not a Promise');
}

if (typeof argv.host === 'string' && argv.host.trim()) {
	config.host = argv.host;
}

if (typeof argv.port === 'number' && !Number.isNaN(argv.port)) {
	config.port = argv.port;
}

console.log('aws-ses-v2-local: starting server...');
server(config)
	.then((s) => {
		console.log(`aws-ses-v2-local: server running at ${getAddress(s)}`);
	})
	.catch((error: unknown) => {
		console.log('aws-ses-v2-local: failed to start server');
		console.error(error);
		process.exit(1);
	});
