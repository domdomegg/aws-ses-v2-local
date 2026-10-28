import type {RequestHandler} from 'express';
import {hasTemplate, setTemplate, templateSchema} from '../store';
import {compileTemplateOrReject} from './templateRequest';
import {sendV2Error} from '../errors';

const handler: RequestHandler = (req, res) => {
	const result = templateSchema.safeParse({...req.body, CreatedTimestamp: Date.now() / 1000});
	if (!result.success) {
		sendV2Error(res, 'BadRequestException', 'aws-ses-v2-local: Schema validation failed');
		return;
	}

	// Check if the template already exists.
	if (hasTemplate(result.data.TemplateName)) {
		sendV2Error(res, 'AlreadyExistsException', 'The resource specified in your request already exists.');
		return;
	}

	// Reject malformed Handlebars up front, as real SES does at create time (rather than
	// hard-failing every later send). Compilation catches only syntax errors, not missing variables.
	if (!compileTemplateOrReject(result.data.TemplateContent, res)) {
		return;
	}

	setTemplate(result.data.TemplateName, result.data);
	res.status(200).send();
};

export default handler;
