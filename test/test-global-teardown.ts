
import type {Server} from 'http';
import './globals';

export default async () => {
	await stopServer(global.__AWS_SES_V2_LOCAL_SERVER);
};

export const stopServer = async (s: Server) => new Promise<void>((resolve, reject) => {
	s.close((err) => {
		if (err) {
			reject(err);
		}

		resolve();
	});
});
