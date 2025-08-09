import type {RequestHandler} from 'express';
import {getStoreReadonly, type Template} from '../store';

const MOCKED_NEXT_TOKEN_PREFIX = 'aws-ses-v2-local-mocked-';

const handler: RequestHandler = (req, res) => {
	const nextToken = req.query.NextToken;
	const pageSize = req.query.PageSize !== undefined ? Number(req.query.PageSize) : 10;

	const {templates} = getStoreReadonly();
	let templateItems = Array.from<[string, Template]>(templates.entries()).sort(([, a], [, b]) => a.CreatedTimestamp - b.CreatedTimestamp);
	if (nextToken) {
		const startIndex = templateItems.findIndex(([name]) => `${MOCKED_NEXT_TOKEN_PREFIX}${name}` === nextToken);
		if (startIndex === -1) {
			res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Invalid NextToken.'});
			return;
		}

		templateItems = templateItems.slice(startIndex + 1);
	}

	if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
		res.status(400).send({
			type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: PageSize must be between 1 and 100',
		});
		return;
	}

	const newNextToken = templateItems.length > pageSize ? `${MOCKED_NEXT_TOKEN_PREFIX}${templateItems[pageSize - 1]![0]}` : undefined;
	const templatesMetadata = templateItems.slice(0, pageSize).map(([, content]) => ({
		CreatedTimestamp: content.CreatedTimestamp,
		TemplateName: content.TemplateName,
	}));

	res.status(200).send({
		TemplatesMetadata: templatesMetadata,
		...(newNextToken ? {NextToken: newNextToken} : {}),
	});
};

export default handler;
