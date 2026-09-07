import {
  apiSuccessSchema,
  paginationMetaSchema,
  publicCategorySchema,
  publicCollectionSchema,
  publicMediaSchema,
  publicProductDetailSchema,
  publicProductSchema,
  publicVariantSchema,
} from '@boss/contracts';
import { z } from 'zod';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const pageSchema = z.object({ data: z.array(z.unknown()), meta: paginationMetaSchema });
type Query = Record<string, string | number | undefined>;
export class CatalogApiError extends Error {}
const request = async <T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  query?: Query,
): Promise<z.infer<T>> => {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(
    ([key, value]) => value !== undefined && params.set(key, String(value)),
  );
  const response = await fetch(`${baseUrl}${path}${params.size ? `?${params}` : ''}`);
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new CatalogApiError('Unable to load the catalog right now.');
  apiSuccessSchema(schema).parse(body);
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new CatalogApiError('Unable to load the catalog right now.');
  }
  return schema.parse(body.data);
};
const paginated = <T extends z.ZodTypeAny>(item: T) =>
  pageSchema.transform((value) => ({
    ...value,
    data: z.array(item).parse(value.data),
  }));
export const catalogApi = {
  categories: () => request('/api/catalog/categories', paginated(publicCategorySchema)),
  collections: () => request('/api/catalog/collections', paginated(publicCollectionSchema)),
  products: (query: Query = {}) =>
    request('/api/catalog/products', paginated(publicProductSchema), query),
  product: (id: string) => request(`/api/catalog/products/${id}`, publicProductDetailSchema),
  variants: (id: string) =>
    request(`/api/catalog/products/${id}/variants`, z.array(publicVariantSchema)),
  media: (id: string) => request(`/api/catalog/products/${id}/media`, z.array(publicMediaSchema)),
};
export type Product = z.infer<typeof publicProductSchema>;
export type ProductDetail = z.infer<typeof publicProductDetailSchema>;
