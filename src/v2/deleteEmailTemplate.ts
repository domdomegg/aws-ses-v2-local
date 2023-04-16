import type { RequestHandler } from 'express';
import { hasTemplate, deleteTemplate } from '../store';

const handler: RequestHandler = (req, res) => {
  const templateName: string = req.params.TemplateName;

  // Check if the template already exists.
  if (!hasTemplate(templateName)) {
    res.status(404).send({ type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.' });
    return;
  }

  deleteTemplate(templateName);
  res.status(200).send();
};

export default handler;
