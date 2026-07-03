import type {RequestHandler} from 'express';
import {
	hasTemplate, getTemplate, setTemplate, templateSchema,
} from '../store';
import {compileTemplateParts, TemplateRenderError} from './renderTemplate';

const handler: RequestHandler = (req, res) => {
	// Express 5 types params as string | string[]; this route has one segment.
	const {TemplateName} = req.params;
	const templateName = Array.isArray(TemplateName) ? TemplateName[0] : TemplateName;

	if (!templateName) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide a template name.'});
		return;
	}

	const existing = getTemplate(templateName);
	if (!hasTemplate(templateName) || !existing) {
		res.status(404).send({type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.'});
		return;
	}

	// TemplateName comes from the URL; the CreatedTimestamp is preserved from the existing template.
	const result = templateSchema.safeParse({...req.body, TemplateName: templateName, CreatedTimestamp: existing.CreatedTimestamp});
	if (!result.success) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	try {
		compileTemplateParts(result.data.TemplateContent);
	} catch (error: unknown) {
		if (!(error instanceof TemplateRenderError)) {
			throw error;
		}

		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: Handlebars compilation failed - ${error.message}`});
		return;
	}

	setTemplate(templateName, result.data);
	res.status(200).send();
};

export default handler;
