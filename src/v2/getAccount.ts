import type {RequestHandler} from 'express';
import {z} from 'zod';

const accountSchema = z.object({
	DedicatedIpAutoWarmupEnabled: z.boolean(),
	Details: z.object({
		AdditionalContactEmailAddresses: z.array(z.string()),
		ContactLanguage: z.string(),
		MailType: z.string(),
		ReviewDetails: z.object({
			CaseId: z.string(),
			Status: z.string(),
		}),
		UseCaseDescription: z.string(),
		WebsiteURL: z.string(),
	}),
	EnforcementStatus: z.string(),
	ProductionAccessEnabled: z.boolean(),
	SendingEnabled: z.boolean(),
	SendQuota: z.object({
		Max24HourSend: z.number(),
		MaxSendRate: z.number(),
		SentLast24Hours: z.number(),
	}),
	SuppressionAttributes: z.object({
		SuppressedReasons: z.array(z.string()),
	}),
});

const handler: RequestHandler = (req, res) => {
	if (!process.env.AWS_SES_ACCOUNT) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Account not found'});
		return;
	}

	const account = JSON.parse(process.env.AWS_SES_ACCOUNT);
	const result = accountSchema.safeParse(account);
	if (!result.success) {
		res.status(400).send({type: 'BadRequestException', message: 'Bad Request Exception', detail: 'aws-ses-v2-local: Schema validation failed'});
		return;
	}

	res.status(200).send(account);
};

export default handler;
