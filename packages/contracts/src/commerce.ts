import { z } from 'zod';
import { idSchema, moneySchema } from './common.js';

export const cartItemInputSchema = z.object({
  variantId: idSchema,
  quantity: z.number().int().min(1).max(99),
});
export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(99) });
export const cartItemSchema = z.object({
  id: idSchema,
  variantId: idSchema,
  productName: z.string(),
  variantName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  subtotal: moneySchema,
  available: z.boolean(),
});
export const cartSchema = z.object({
  id: idSchema,
  currency: z.literal('INR'),
  items: z.array(cartItemSchema),
  subtotal: moneySchema,
  itemCount: z.number().int().nonnegative(),
});
export const checkoutAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(6).max(30),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(3).max(20),
  countryCode: z.string().length(2).default('IN'),
});
export const checkoutInputSchema = z.object({
  shippingAddress: checkoutAddressSchema,
  idempotencyKey: z.string().min(16).max(128),
});
export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'CUSTOMIZATION_REQUIRED',
  'IN_PRODUCTION',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);
export const paymentStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
]);
export const orderItemSchema = z.object({
  id: idSchema,
  productName: z.string(),
  variantName: z.string().nullable(),
  sku: z.string().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  lineTotal: moneySchema,
});
export const orderSchema = z.object({
  id: idSchema,
  number: z.string(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  currency: z.literal('INR'),
  subtotal: moneySchema,
  total: moneySchema,
  shippingAddress: checkoutAddressSchema,
  items: z.array(orderItemSchema),
  createdAt: z.string().datetime(),
});
