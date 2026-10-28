import type {RequestHandler} from 'express';
import {setTemplate, templateSchema} from '../store';
import {compileTemplateOrReject, requireTemplate} from './templateRequest';
import {sendV2Error} from '../errors';

const handler: RequestHandler = (req, res) => {
	const existing = requireTemplate(req, res);
	if (!existing) {
		return;
	}

	// TemplateName comes from the URL; the CreatedTimestamp is preserved from the existing template.
	const result = templateSchema.safeParse({...req.body, TemplateName: existing.TemplateName, CreatedTimestamp: existing.CreatedTimestamp});
	if (!result.success) {
		sendV2Error(res, 'BadRequestException', 'aws-ses-v2-local: Schema validation failed');
		return;
	}

	if (!compileTemplateOrReject(result.data.TemplateContent, res)) {
		return;
	}

	setTemplate(existing.TemplateName, result.data);
	res.status(200).send();
};

export default handler;
