import type {RequestHandler} from 'express';
import {deleteTemplate} from '../store';
import {requireTemplate} from './templateRequest';

const handler: RequestHandler = (req, res) => {
	const template = requireTemplate(req, res);
	if (!template) {
		return;
	}

	deleteTemplate(template.TemplateName);
	res.status(200).send();
};

export default handler;
