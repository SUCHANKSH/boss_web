import { z } from 'zod';
import {
  currencySchema,
  idSchema,
  metadataSchema,
  moneySchema,
  paginationQuerySchema,
  slugSchema,
  sortOrderSchema,
  timestampSchema,
} from './common.js';

export const lifecycleStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const mediaPurposeSchema = z.enum(['MASTER', 'THUMBNAIL', 'GALLERY', 'MOCKUP', 'BANNER']);
export const inventoryAdjustmentReasonSchema = z.enum([
  'INITIAL_STOCK',
  'RESTOCK',
  'CORRECTION',
  'DAMAGED',
  'RETURNED',
  'ORDER_CHECKOUT',
]);
const seoSchema = z.object({
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
});
const mutableText = z.string().max(10_000).nullable().optional();
export const mediaSchema = z.object({
  id: idSchema,
  scope: z.enum(['PUBLIC_PRODUCT', 'PRIVATE_CUSTOMIZATION']),
  purpose: mediaPurposeSchema,
  storageProvider: z.string(),
  storageKey: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  checksum: z.string().nullable(),
  altText: z.string().nullable(),
  metadata: metadataSchema.nullable(),
  artworkId: idSchema.nullable(),
  productId: idSchema.nullable(),
  variantId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  collectionId: idSchema.nullable(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const createMediaSchema = z.object({
  scope: z.enum(['PUBLIC_PRODUCT', 'PRIVATE_CUSTOMIZATION']),
  purpose: mediaPurposeSchema.optional(),
  storageProvider: z.string().min(1).max(100).optional(),
  storageKey: z.string().min(1).max(500),
  url: z.string().url(),
  mimeType: z.string().min(1).max(160),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().nullable().optional(),
  checksum: z.string().max(256).nullable().optional(),
  altText: z.string().max(500).nullable().optional(),
  metadata: metadataSchema.nullable().optional(),
  artworkId: idSchema.nullable().optional(),
  productId: idSchema.nullable().optional(),
  variantId: idSchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  collectionId: idSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export const updateMediaSchema = createMediaSchema.omit({ storageKey: true }).partial();
export const categorySchema = z
  .object({
    id: idSchema,
    name: z.string(),
    slug: slugSchema,
    description: z.string().nullable(),
    parentId: idSchema.nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .merge(seoSchema);
export const createCategorySchema = z
  .object({
    name: z.string().min(1).max(160),
    slug: slugSchema,
    description: mutableText,
    parentId: idSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .merge(seoSchema);
export const updateCategorySchema = createCategorySchema.partial();
export const categoryListQuerySchema = paginationQuerySchema.extend({
  parentId: idSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'sortOrder']).default('sortOrder'),
  sortOrder: sortOrderSchema,
});
export const collectionSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    slug: slugSchema,
    description: z.string().nullable(),
    isActive: z.boolean(),
    status: lifecycleStatusSchema,
    sortOrder: z.number().int(),
    startsAt: timestampSchema.nullable(),
    endsAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .merge(seoSchema);
export const createCollectionSchema = z
  .object({
    name: z.string().min(1).max(160),
    slug: slugSchema,
    description: mutableText,
    isActive: z.boolean().optional(),
    status: lifecycleStatusSchema.optional(),
    sortOrder: z.number().int().optional(),
    startsAt: timestampSchema.nullable().optional(),
    endsAt: timestampSchema.nullable().optional(),
  })
  .merge(seoSchema);
export const updateCollectionSchema = createCollectionSchema.partial();
export const artworkAdminSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: slugSchema,
  description: z.string().nullable(),
  artistCredit: z.string().nullable(),
  tags: z.array(z.string()),
  isActive: z.boolean(),
  status: lifecycleStatusSchema,
  sourceType: z.string().nullable(),
  rightsHolder: z.string().nullable(),
  licenseReference: z.string().nullable(),
  internalNotes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const createArtworkSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: mutableText,
  artistCredit: z.string().max(160).nullable().optional(),
  tags: z.array(z.string().max(80)).default([]),
  isActive: z.boolean().optional(),
  status: lifecycleStatusSchema.optional(),
  sourceType: z.string().max(100).nullable().optional(),
  rightsHolder: z.string().max(200).nullable().optional(),
  licenseReference: z.string().max(500).nullable().optional(),
  internalNotes: z.string().max(10_000).nullable().optional(),
});
export const updateArtworkSchema = createArtworkSchema.partial();
export const variantSchema = z.object({
  id: idSchema,
  productId: idSchema,
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  name: z.string(),
  attributes: metadataSchema,
  price: moneySchema,
  compareAtPrice: moneySchema.nullable(),
  isActive: z.boolean(),
  inventoryPolicy: z.enum(['TRACKED', 'MADE_TO_ORDER', 'UNLIMITED']),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const createVariantSchema = z.object({
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  name: z.string().min(1).max(160),
  attributes: metadataSchema,
  pricePaise: z.number().int().nonnegative(),
  compareAtPricePaise: z.number().int().nonnegative().nullable().optional(),
  currency: currencySchema.optional(),
  isActive: z.boolean().optional(),
  inventoryPolicy: z.enum(['TRACKED', 'MADE_TO_ORDER', 'UNLIMITED']).optional(),
});
export const updateVariantSchema = createVariantSchema.omit({ sku: true }).partial();
export const productAdminSchema = z
  .object({
    id: idSchema,
    artworkId: idSchema.nullable(),
    name: z.string(),
    slug: slugSchema,
    description: z.string().nullable(),
    shortDescription: z.string().nullable(),
    productType: z.string(),
    status: lifecycleStatusSchema,
    isCustomizable: z.boolean(),
    publishedAt: timestampSchema.nullable(),
    sortOrder: z.number().int(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .merge(seoSchema);
export const createProductSchema = z
  .object({
    artworkId: idSchema.nullable().optional(),
    name: z.string().min(1).max(200),
    slug: slugSchema,
    description: mutableText,
    shortDescription: z.string().max(500).nullable().optional(),
    productType: z.string().min(1).max(80),
    status: lifecycleStatusSchema.optional(),
    isCustomizable: z.boolean().optional(),
    publishedAt: timestampSchema.nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .merge(seoSchema);
export const updateProductSchema = createProductSchema.partial();
export const productListQuerySchema = paginationQuerySchema.extend({
  status: lifecycleStatusSchema.optional(),
  category: slugSchema.optional(),
  collection: slugSchema.optional(),
  productType: z.string().max(80).optional(),
  minPricePaise: z.coerce.number().int().nonnegative().optional(),
  maxPricePaise: z.coerce.number().int().nonnegative().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'sortOrder', 'price']).default('createdAt'),
  sortOrder: sortOrderSchema,
});
export const inventorySchema = z.object({
  id: idSchema,
  variantId: idSchema,
  available: z.number().int(),
  reserved: z.number().int(),
  reorderLevel: z.number().int().nullable(),
  updatedAt: timestampSchema,
});
export const inventoryAdjustmentSchema = z.object({
  id: idSchema,
  inventoryId: idSchema,
  delta: z.number().int(),
  reason: inventoryAdjustmentReasonSchema,
  actorId: idSchema.nullable(),
  referenceId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: timestampSchema,
});
export const createInventoryAdjustmentSchema = z.object({
  variantId: idSchema,
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0),
  reason: inventoryAdjustmentReasonSchema,
  referenceId: z.string().max(160).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
