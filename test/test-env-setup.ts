import axios from 'axios';
import {baseURL} from './globals';

beforeEach(async () => {
	await axios({
		method: 'post',
		url: '/clear-store',
		baseURL,
	});
});
