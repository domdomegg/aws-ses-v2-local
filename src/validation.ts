import {z} from 'zod';

// Common schema fragments that may be reused
export const charsetDataSchema = z.object({
	Charset: z.string().optional(),
	Data: z.string(),
});

// Custom message headers, accepted on Simple, Template, and bulk Template content.
export const messageHeadersSchema = z.array(z.object({
	Name: z.string(),
	Value: z.string(),
})).optional();

export const emailAddressListSchema = z.object({
	BccAddresses: z.array(z.string()).optional(),
	CcAddresses: z.array(z.string()).optional(),
	ToAddresses: z.array(z.string()).optional(),
});
