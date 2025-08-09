import type {RequestHandler} from 'express';
import {
	hasTemplate, setTemplate, templateSchema,
} from '../store';

const handler: RequestHandler = (req, res) => {
	const result = templateSchema.safeParse({...req.body, CreatedTimestamp: Date.now() / 1000});
	if (!result.success) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	// Check if the template already exists.
	if (hasTemplate(result.data.TemplateName)) {
		res.status(400).send({type: 'AlreadyExistsException', message: 'The resource specified in your request already exists.'});
		return;
	}

	setTemplate(result.data.TemplateName, result.data);
	res.status(200).send();
};

export default handler;
