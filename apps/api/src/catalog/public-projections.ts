import {
  publicArtworkSchema,
  publicCategorySchema,
  publicCollectionSchema,
  publicMediaSchema,
  publicProductDetailSchema,
  publicProductSchema,
  publicVariantSchema,
  currencySchema,
  metadataSchema,
} from '@boss/contracts';
import { AppError } from '../errors/app-error.js';

type MediaRecord = {
  id: string;
  url: string;
  purpose: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
};
type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
};
type CollectionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
};
type VariantRecord = {
  id: string;
  name: string;
  attributes: unknown;
  pricePaise: number;
  compareAtPricePaise: number | null;
  currency: string;
  isActive: boolean;
  inventory?: { available: number } | null;
};

export const toPublicMedia = (media: MediaRecord) =>
  publicMediaSchema.parse({ ...media, purpose: media.purpose });
export const toPublicCategory = (category: CategoryRecord) => publicCategorySchema.parse(category);
export const toPublicCollection = (collection: CollectionRecord) =>
  publicCollectionSchema.parse({
    ...collection,
    startsAt: collection.startsAt?.toISOString() ?? null,
    endsAt: collection.endsAt?.toISOString() ?? null,
  });
export const toPublicArtwork = (artwork: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  artistCredit: string | null;
  tags: string[];
}) => publicArtworkSchema.parse(artwork);
export const toPublicVariant = (variant: VariantRecord) =>
  publicVariantSchema.parse({
    id: variant.id,
    name: variant.name,
    attributes: metadataSchema.parse(variant.attributes),
    price: { amountMinor: variant.pricePaise, currency: currencySchema.parse(variant.currency) },
    compareAtPrice:
      variant.compareAtPricePaise === null
        ? null
        : {
            amountMinor: variant.compareAtPricePaise,
            currency: currencySchema.parse(variant.currency),
          },
    isActive: variant.isActive,
  });

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  productType: string;
  isCustomizable: boolean;
  status: string;
  media: MediaRecord[];
  variants: VariantRecord[];
  categories: Array<{ category: CategoryRecord }> | CategoryRecord[];
  collections: Array<{ collection: CollectionRecord }> | CollectionRecord[];
};
const categoryValue = (value: { category: CategoryRecord } | CategoryRecord) =>
  'category' in value ? value.category : value;
const collectionValue = (value: { collection: CollectionRecord } | CollectionRecord) =>
  'collection' in value ? value.collection : value;

/** Converts explicitly loaded records into a contract-validated, public-safe response. */
export const toPublicProduct = (product: ProductRecord) => {
  if (product.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Product was not found.');
  const variants = product.variants.filter((variant) => variant.isActive).map(toPublicVariant);
  const starting = product.variants
    .filter((variant) => variant.isActive)
    .map((variant) => variant.pricePaise)
    .sort((a, b) => a - b)[0];
  const media = product.media.map(toPublicMedia);
  const result = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    productType: product.productType,
    isCustomizable: product.isCustomizable,
    thumbnail: media.find((item) => item.purpose === 'THUMBNAIL') ?? null,
    startingPrice:
      starting === undefined ? null : { amountMinor: starting, currency: 'INR' as const },
    available: product.variants.some(
      (variant) => variant.isActive && (variant.inventory?.available ?? 0) > 0,
    ),
    categories: product.categories.map(categoryValue).map(toPublicCategory),
    collections: product.collections.map(collectionValue).map(toPublicCollection),
    media,
    variants,
  };
  return publicProductDetailSchema.parse(result);
};
export const toPublicProductSummary = (product: ProductRecord) =>
  publicProductSchema.parse(toPublicProduct(product));
