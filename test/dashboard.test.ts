import {test, expect} from 'vitest';
import axios from 'axios';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type {Server} from 'http';
import {getAddress} from '../src/address';
import {baseURL} from './globals';

test('serves the web dashboard at /', async () => {
	const res = await axios({
		method: 'get',
		baseURL,
		url: '/',
	});

	expect(res.status).toBe(200);
	expect(res.headers['content-type']).toContain('text/html');
	expect(res.data).toContain('aws-ses-v2-local');
});

// Regression test for https://github.com/domdomegg/aws-ses-v2-local/issues/106
// npx and pnpm dlx install the package under dot-prefixed cache directories
// (~/.npm/_npx/..., .../node_modules/.pnpm/...). Express 5's send defaults
// `dotfiles` to 'ignore', which 404s the dashboard if we resolve the file as a
// single absolute path containing such a segment.
test('serves the web dashboard when installed under a dot-prefixed directory', async () => {
	const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aws-ses-v2-local-'));
	// A dot-prefixed ancestor directory, as npx/pnpm dlx would create
	const installDir = path.join(tmp, '.npx-cache', 'aws-ses-v2-local');
	await fs.mkdir(installDir, {recursive: true});
	await fs.cp(path.join(__dirname, '..', 'src'), path.join(installDir, 'src'), {recursive: true});
	await fs.cp(path.join(__dirname, '..', 'static'), path.join(installDir, 'static'), {recursive: true});

	let s: Server | undefined;
	try {
		const {default: serverFromDotDir} = await import(path.join(installDir, 'src', 'index.ts'));
		s = await serverFromDotDir({port: 0, host: '127.0.0.1'}) as Server;

		const res = await axios({
			method: 'get',
			baseURL: getAddress(s),
			url: '/',
		});

		expect(res.status).toBe(200);
		expect(res.data).toContain('aws-ses-v2-local');
	} finally {
		if (s) {
			await new Promise<void>((resolve, reject) => {
				s!.close((err) => {
					if (err) {
						reject(err);
						return;
					}

					resolve();
				});
			});
		}

		await fs.rm(tmp, {recursive: true, force: true});
	}
});
