#!/usr/bin/env node

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import server, {type Config} from '.';
import {getAddress} from './address';

// Parse the command line optional host and port arguments.

const argv = yargs(hideBin(process.argv))
	.option('host', {type: 'string'})
	.option('port', {type: 'number'})
	.parseSync();

const config: Partial<Config> = {};

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
