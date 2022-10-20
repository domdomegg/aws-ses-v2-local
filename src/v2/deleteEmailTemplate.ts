import type { RequestHandler } from 'express';
import store from '../store';

const handler: RequestHandler = (req, res, next) => {
  const templateName: string = req.params.TemplateName;

  // Check if the template already exists.
  if (!store.templates.has(templateName)) {
    res.status(404).send({ type: 'NotFoundException', message: 'The resource you attempted to access doesn\'t exist.' });
    return;
  }

  store.templates.delete(templateName);
  res.status(200).send();
};

export default handler;
