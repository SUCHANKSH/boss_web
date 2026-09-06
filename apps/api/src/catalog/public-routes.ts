import {
  categoryListQuerySchema,
  idSchema,
  paginationQuerySchema,
  publicProductListQuerySchema,
} from '@boss/contracts';
import type { PrismaClient } from '@boss/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  toPublicCategory,
  toPublicCollection,
  toPublicProduct,
  toPublicProductSummary,
} from './public-projections.js';
import { CatalogService } from './service.js';

const idParams = z.object({ id: idSchema });
const page = paginationQuerySchema;
const success = <T>(data: T) => ({ success: true, data });
export function registerPublicCatalogRoutes(app: FastifyInstance, database: PrismaClient) {
  const service = new CatalogService(database);
  app.get('/api/catalog/categories', async (request) => {
    const value = await service.listPublicCategories(categoryListQuerySchema.parse(request.query));
    return success({ ...value, data: value.data.map(toPublicCategory) });
  });
  app.get('/api/catalog/categories/:id', async (request) => {
    return success(
      toPublicCategory(await service.getPublicCategoryById(idParams.parse(request.params).id)),
    );
  });
  app.get('/api/catalog/collections', async (request) => {
    const value = await service.listPublicCollections(page.parse(request.query));
    return success({ ...value, data: value.data.map(toPublicCollection) });
  });
  app.get('/api/catalog/collections/:id', async (request) =>
    success(
      toPublicCollection(await service.getPublicCollectionById(idParams.parse(request.params).id)),
    ),
  );
  app.get('/api/catalog/products', async (request) => {
    const value = await service.listPublicProducts(
      publicProductListQuerySchema.parse(request.query),
    );
    return success({ ...value, data: value.data.map(toPublicProductSummary) });
  });
  app.get('/api/catalog/products/:id', async (request) =>
    success(toPublicProduct(await service.getPublicProductById(idParams.parse(request.params).id))),
  );
  app.get('/api/catalog/products/:id/variants', async (request) =>
    success(
      toPublicProduct(await service.getPublicProductById(idParams.parse(request.params).id))
        .variants,
    ),
  );
  app.get('/api/catalog/products/:id/media', async (request) =>
    success(
      toPublicProduct(await service.getPublicProductById(idParams.parse(request.params).id)).media,
    ),
  );
}
