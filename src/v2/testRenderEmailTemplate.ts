import type {RequestHandler} from 'express';
import MailComposer from 'nodemailer/lib/mail-composer';
import {z} from 'zod';
import {getTemplate} from '../store';
import {
	compileTemplateParts, parseTemplateData, TemplateRenderError,
} from './renderTemplate';

// TemplateData is required in the real API (unlike the send paths, where it is optional).
const testRenderSchema = z.object({
	TemplateData: z.string(),
});

// SES returns the complete MIME message for the rendered template.
const buildMimeMessage = async (subject: string, html: string, text: string): Promise<string> => {
	const mail = new MailComposer({
		subject,
		...(html ? {html} : {}),
		...(text ? {text} : {}),
	});
	const message = await mail.compile().build();
	return message.toString('utf-8');
};

const handler: RequestHandler = async (req, res) => {
	// Express 5 types params as string | string[]; this route has one segment.
	const {TemplateName} = req.params;
	const templateName = Array.isArray(TemplateName) ? TemplateName[0] : TemplateName;

	if (!templateName) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide a template name.'});
		return;
	}

	const template = getTemplate(templateName);
	if (!template) {
		res.status(404).send({type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.'});
		return;
	}

	const result = testRenderSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Must provide TemplateData.'});
		return;
	}

	const templateData = parseTemplateData(result.data.TemplateData);
	if (templateData instanceof Error) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: ${templateData.message}`});
		return;
	}

	let subject: string;
	let html: string;
	let text: string;
	try {
		// Always strict: unlike the send paths (where real SES reports rendering failures
		// asynchronously), real SES fails this synchronous API with a 400 when the data is
		// missing attributes referenced by the template (MissingRenderingAttribute).
		({subject, html, text} = compileTemplateParts(template.TemplateContent, {strict: true})(templateData));
	} catch (error: unknown) {
		if (!(error instanceof TemplateRenderError)) {
			throw error;
		}

		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: `aws-ses-v2-local: template rendering failed - ${error.message}`});
		return;
	}

	const renderedTemplate = await buildMimeMessage(subject, html, text);
	res.status(200).send({RenderedTemplate: renderedTemplate});
};

export default handler;
