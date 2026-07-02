import type {RequestHandler} from 'express';
import {
	hasTemplate, setTemplate, templateSchema,
} from '../store';
import {compileTemplateParts, TemplateRenderError} from './renderTemplate';

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

	// Reject malformed Handlebars up front, as real SES does at create time (rather than
	// hard-failing every later send). Compilation catches only syntax errors, not missing variables.
	try {
		compileTemplateParts(result.data.TemplateContent);
	} catch (error: unknown) {
		if (!(error instanceof TemplateRenderError)) {
			throw error;
		}

		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Handlebars compilation failed - ${error.message}`});
		return;
	}

	setTemplate(result.data.TemplateName, result.data);
	res.status(200).send();
};

export default handler;
