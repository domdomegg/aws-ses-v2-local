import {z} from 'zod';

// Common schema fragments that may be reused
export const charsetDataSchema = z.object({
	Charset: z.string().optional(),
	Data: z.string(),
});

export const emailAddressListSchema = z.object({
	BccAddresses: z.array(z.string()).optional(),
	CcAddresses: z.array(z.string()).optional(),
	ToAddresses: z.array(z.string()).optional(),
});
