import axios from 'axios';
import {baseURL} from './globals';
import {beforeEach} from 'vitest';

beforeEach(async () => {
	await axios({
		method: 'post',
		url: '/clear-store',
		baseURL,
	});
});
