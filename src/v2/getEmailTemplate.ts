import type {RequestHandler} from 'express';
import {hasTemplate, getTemplate} from '../store';

const handler: RequestHandler = (req, res) => {
	const templateName = req.params.TemplateName;

	if (!templateName) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide a template name.'});
		return;
	}

	const template = getTemplate(templateName);
	if (!hasTemplate(templateName) || !template?.TemplateName || !template?.TemplateContent) {
		res.status(404).send({type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.'});
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
