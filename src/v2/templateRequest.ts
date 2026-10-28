import type {Request, Response} from 'express';
import {getTemplate, type Template} from '../store';
import {compileTemplateParts, TemplateRenderError, type TemplateParts} from './renderTemplate';
import {sendV2Error} from '../errors';

// Express 5 types route params as string | string[]; our template routes have a single segment.
export const getTemplateNameParam = (req: Request): string | undefined => {
	const {TemplateName} = req.params;
	return Array.isArray(TemplateName) ? TemplateName[0] : TemplateName;
};

// Resolve the :TemplateName route param to a stored template, sending the appropriate error
// (400 for a missing name, 404 for an unknown template) and returning undefined on failure.
export const requireTemplate = (req: Request, res: Response): Template | undefined => {
	const templateName = getTemplateNameParam(req);
	if (!templateName) {
		sendV2Error(res, 'BadRequestException', 'aws-ses-v2-local: Must provide a template name.');
		return undefined;
	}

	const template = getTemplate(templateName);
	if (!template) {
		sendV2Error(res, 'NotFoundException', 'The resource you attempted to access doesn\'t exist.');
		return undefined;
	}

	return template;
};

// Validate template content compiles (real SES rejects malformed Handlebars at create/update time).
// Returns true when valid; otherwise sends a 400 and returns false.
export const compileTemplateOrReject = (content: TemplateParts, res: Response): boolean => {
	try {
		compileTemplateParts(content);
		return true;
	} catch (error: unknown) {
		if (!(error instanceof TemplateRenderError)) {
			throw error;
		}

		sendV2Error(res, 'BadRequestException', `aws-ses-v2-local: Handlebars compilation failed - ${error.message}`);
		return false;
	}
};
