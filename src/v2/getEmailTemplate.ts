import type {RequestHandler} from 'express';
import {requireTemplate} from './templateRequest';

const handler: RequestHandler = (req, res) => {
	const template = requireTemplate(req, res);
	if (!template) {
		return;
	}

	const {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		CreatedTimestamp,
		...rest
	} = template;

	res.status(200).send(rest);
};

export default handler;
