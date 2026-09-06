import {
  artworkAdminSchema,
  categorySchema,
  collectionSchema,
  inventoryAdjustmentSchema,
  inventorySchema,
  mediaSchema,
  productAdminSchema,
  variantSchema,
} from '@boss/contracts';

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toAdminCategory = (value: any) /* persisted record, allow-listed below */ =>
  categorySchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
/*
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}) =>
  categorySchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminCollection = (value: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  status: string;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) =>
  collectionSchema.parse({
    ...value,
    startsAt: iso(value.startsAt),
    endsAt: iso(value.endsAt),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
*/
export const toAdminCollection = (value: any) =>
  collectionSchema.parse({
    ...value,
    startsAt: iso(value.startsAt),
    endsAt: iso(value.endsAt),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminArtwork = (value: any) =>
  artworkAdminSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
/*
  id: string;
  title: string;
  slug: string;
  description: string | null;
  artistCredit: string | null;
  tags: string[];
  isActive: boolean;
  status: string;
  sourceType: string | null;
  rightsHolder: string | null;
  licenseReference: string | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) =>
  artworkAdminSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminProduct = (value: {
  id: string;
  artworkId: string | null;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  productType: string;
  status: string;
  isCustomizable: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) =>
  productAdminSchema.parse({
    ...value,
    publishedAt: iso(value.publishedAt),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
*/
export const toAdminProduct = (value: any) =>
  productAdminSchema.parse({
    ...value,
    publishedAt: iso(value.publishedAt),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminVariant = (value: any) =>
  variantSchema.parse({
    id: value.id,
    productId: value.productId,
    sku: value.sku,
    name: value.name,
    attributes: value.attributes,
    price: { amountMinor: value.pricePaise, currency: value.currency },
    compareAtPrice:
      value.compareAtPricePaise === null
        ? null
        : { amountMinor: value.compareAtPricePaise, currency: value.currency },
    isActive: value.isActive,
    inventoryPolicy: value.inventoryPolicy,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
/*
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  pricePaise: number;
  compareAtPricePaise: number | null;
  currency: 'INR';
  isActive: boolean;
  inventoryPolicy: string;
  createdAt: Date;
  updatedAt: Date;
}) =>
  variantSchema.parse({
    id: value.id,
    productId: value.productId,
    sku: value.sku,
    name: value.name,
    attributes: value.attributes,
    price: { amountMinor: value.pricePaise, currency: value.currency },
    compareAtPrice:
      value.compareAtPricePaise === null
        ? null
        : { amountMinor: value.compareAtPricePaise, currency: value.currency },
    isActive: value.isActive,
    inventoryPolicy: value.inventoryPolicy,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminMedia = (value: Record<string, unknown>) =>
  mediaSchema.parse({
    ...value,
    createdAt: (value.createdAt as Date).toISOString(),
    updatedAt: (value.updatedAt as Date).toISOString(),
  });
*/
export const toAdminMedia = (value: any) =>
  mediaSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
export const toAdminInventory = (value: {
  id: string;
  variantId: string;
  available: number;
  reserved: number;
  reorderLevel: number | null;
  updatedAt: Date;
}) => inventorySchema.parse({ ...value, updatedAt: value.updatedAt.toISOString() });
export const toAdminAdjustment = (value: {
  id: string;
  inventoryId: string;
  delta: number;
  reason: string;
  actorId: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
}) => inventoryAdjustmentSchema.parse({ ...value, createdAt: value.createdAt.toISOString() });
