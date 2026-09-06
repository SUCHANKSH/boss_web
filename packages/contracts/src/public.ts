import { z } from 'zod';
import {
  categorySchema,
  collectionSchema,
  mediaSchema,
  productListQuerySchema,
  productAdminSchema,
  variantSchema,
} from './catalog.js';
import { paginationQuerySchema } from './common.js';

export const publicMediaSchema = mediaSchema.pick({
  id: true,
  url: true,
  purpose: true,
  altText: true,
  width: true,
  height: true,
  sortOrder: true,
});
export const publicCategorySchema = categorySchema.pick({
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  sortOrder: true,
});
export const publicCollectionSchema = collectionSchema.pick({
  id: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  startsAt: true,
  endsAt: true,
});
export const publicArtworkSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  artistCredit: z.string().nullable(),
  tags: z.array(z.string()),
});
export const publicVariantSchema = variantSchema.pick({
  id: true,
  name: true,
  attributes: true,
  price: true,
  compareAtPrice: true,
  isActive: true,
});
export const publicProductSchema = productAdminSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    description: true,
    shortDescription: true,
    productType: true,
    isCustomizable: true,
  })
  .extend({
    thumbnail: publicMediaSchema.nullable(),
    startingPrice: z
      .object({ amountMinor: z.number().int().nonnegative(), currency: z.literal('INR') })
      .nullable(),
    available: z.boolean(),
    categories: z.array(publicCategorySchema),
    collections: z.array(publicCollectionSchema),
  });
export const publicProductDetailSchema = publicProductSchema.extend({
  media: z.array(publicMediaSchema),
  variants: z.array(publicVariantSchema),
});
export const publicProductListQuerySchema = productListQuerySchema
  .omit({ status: true })
  .extend({ page: paginationQuerySchema.shape.page, limit: paginationQuerySchema.shape.limit });
