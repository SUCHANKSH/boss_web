import { z } from 'zod';

export const idSchema = z.string().regex(/^c[a-z0-9]{8,}$/i, 'Invalid identifier.');
export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug.');
export const timestampSchema = z.string().datetime();
export const currencySchema = z.literal('INR');
export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: currencySchema,
});
export const metadataSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  ]),
);
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DATABASE_ERROR',
  'INTERNAL_ERROR',
]);
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export const apiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data });
