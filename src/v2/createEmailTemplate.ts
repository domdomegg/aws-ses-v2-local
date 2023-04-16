import type { RequestHandler } from 'express';
import type { JSONSchema7 } from 'json-schema';
import ajv from '../ajv';
import { hasTemplate, setTemplate, Template } from '../store';

const handler: RequestHandler = (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    res.status(404).send({ type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed' });
    return;
  }

  const template: Template = req.body;

  // Check if the template already exists.
  if (hasTemplate(template.TemplateName)) {
    res.status(400).send({ type: 'AlreadyExistsException', message: 'The resource specified in your request already exists.' });
    return;
  }

  setTemplate(template.TemplateName, template);
  res.status(200).send();
};

export default handler;

const templateSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    TemplateContent: {
      type: 'object',
      properties: {
        Html: { type: 'string' },
        Subject: { type: 'string' },
        Text: { type: 'string' },
      },
      required: ['Subject'],
    },
    TemplateName: { type: 'string' },
  },
  required: ['TemplateContent', 'TemplateName'],
};

const validate = ajv.compile(templateSchema);
