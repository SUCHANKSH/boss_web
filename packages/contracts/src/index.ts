export * from './common.js';
export * from './catalog.js';
export * from './public.js';
export * from './commerce.js';
import { z } from 'zod';
export const userRoleSchema = z.enum(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']);
export type UserRole = z.infer<typeof userRoleSchema>;
