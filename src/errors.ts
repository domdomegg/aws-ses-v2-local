import {randomUUID} from 'crypto';
import type {Response} from 'express';

const v2ErrorStatuses = {
	BadRequestException: 400,
	AlreadyExistsException: 400,
	NotFoundException: 404,
	UnknownOperationException: 404,
} as const;

/**
 * Send an SES v2 (REST-JSON) error. The AWS SDK reads the error name from the
 * x-amzn-errortype header and the error message from the body's message field.
 */
export const sendV2Error = (res: Response, code: keyof typeof v2ErrorStatuses, message: string): void => {
	res.status(v2ErrorStatuses[code]).set('x-amzn-errortype', code).send({message});
};

const escapeXml = (s: string): string => s
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;');

/**
 * Send an SES v1 (AWS Query) error. The AWS SDK parses these from an XML ErrorResponse.
 */
export const sendV1Error = (res: Response, code: 'InvalidParameterValue' | 'ValidationError' | 'InvalidAction', message: string): void => {
	res.status(400).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><ErrorResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><Error><Type>Sender</Type><Code>${code}</Code><Message>${escapeXml(message)}</Message></Error><RequestId>${randomUUID()}</RequestId></ErrorResponse>`);
};
