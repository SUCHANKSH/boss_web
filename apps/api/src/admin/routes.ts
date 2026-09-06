import {
  categoryListQuerySchema,
  createArtworkSchema,
  createCategorySchema,
  createCollectionSchema,
  createMediaSchema,
  createProductSchema,
  createVariantSchema,
  idSchema,
  slugSchema,
  updateArtworkSchema,
  updateCategorySchema,
  updateCollectionSchema,
  updateMediaSchema,
  updateProductSchema,
  updateVariantSchema,
} from '@boss/contracts';
import { UserRole, type PrismaClient } from '@boss/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CatalogService } from '../catalog/service.js';
import {
  toAdminCategory,
  toAdminCollection,
  toAdminArtwork,
  toAdminProduct,
  toAdminVariant,
  toAdminMedia,
  toAdminInventory,
  toAdminAdjustment,
} from './projections.js';
import { authenticate, requireRole } from '../plugins/auth.js';

const idParams = z.object({ id: idSchema });
const slugParams = z.object({ slug: slugSchema });
const productParams = z.object({ productId: idSchema });
const variantParams = z.object({ variantId: idSchema });
const artworkParams = z.object({ artworkId: idSchema });
const productCategoryParams = z.object({ id: idSchema, categoryId: idSchema });
const productCollectionParams = z.object({ id: idSchema, collectionId: idSchema });
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const inventoryAdjustmentBody = z.object({
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0),
  reason: z.enum(['INITIAL_STOCK', 'RESTOCK', 'CORRECTION', 'DAMAGED', 'RETURNED']),
  referenceId: z.string().max(160).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
const relationsBody = z.object({ ids: z.array(idSchema).max(100) });
const success = <T>(data: T) => ({ success: true, data });
const adminOnly = (database: PrismaClient) => ({
  preHandler: [
    (request: Parameters<typeof authenticate>[0]) => authenticate(request, database),
    requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  ],
});

/** HTTP-only adapter: all catalog decisions remain in CatalogService. */
export function registerAdminRoutes(app: FastifyInstance, database: PrismaClient): void {
  const service = new CatalogService(database);
  const guarded = adminOnly(database);
  app.post('/api/admin/categories', guarded, async (request, reply) => {
    const created = await service.createCategory(createCategorySchema.parse(request.body));
    if (!created) throw new Error('Category creation did not return a record.');
    return reply.status(201).send(success(toAdminCategory(created)));
  });
  app.get('/api/admin/categories', guarded, async (request) => {
    const result = await service.listCategories(categoryListQuerySchema.parse(request.query));
    return success({ ...result, data: result.data.map(toAdminCategory) });
  });
  app.get('/api/admin/categories/slug/:slug', guarded, async (request) =>
    success(
      toAdminCategory(await service.getCategoryBySlug(slugParams.parse(request.params).slug)),
    ),
  );
  app.get('/api/admin/categories/:id', guarded, async (request) =>
    success(toAdminCategory(await service.getCategoryById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/categories/:id', guarded, async (request) =>
    success(
      toAdminCategory(
        await service.updateCategory(
          idParams.parse(request.params).id,
          updateCategorySchema.parse(request.body),
        )!,
      ),
    ),
  );
  app.post('/api/admin/categories/:id/archive', guarded, async (request) =>
    success(toAdminCategory(await service.archiveCategory(idParams.parse(request.params).id))),
  );

  app.post('/api/admin/collections', guarded, async (request, reply) => {
    const value = await service.createCollection(createCollectionSchema.parse(request.body));
    return reply.status(201).send(success(toAdminCollection(value!)));
  });
  app.get('/api/admin/collections', guarded, async (request) => {
    const value = await service.listCollections(pageQuery.parse(request.query));
    return success({ ...value, data: value.data.map(toAdminCollection) });
  });
  app.get('/api/admin/collections/slug/:slug', guarded, async (request) =>
    success(
      toAdminCollection(await service.getCollectionBySlug(slugParams.parse(request.params).slug)),
    ),
  );
  app.get('/api/admin/collections/:id', guarded, async (request) =>
    success(toAdminCollection(await service.getCollectionById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/collections/:id', guarded, async (request) =>
    success(
      toAdminCollection(
        await service.updateCollection(
          idParams.parse(request.params).id,
          updateCollectionSchema.parse(request.body),
        )!,
      ),
    ),
  );
  app.post('/api/admin/collections/:id/archive', guarded, async (request) =>
    success(toAdminCollection(await service.archiveCollection(idParams.parse(request.params).id))),
  );

  app.post('/api/admin/artwork', guarded, async (request, reply) => {
    const value = await service.createArtwork(createArtworkSchema.parse(request.body));
    return reply.status(201).send(success(toAdminArtwork(value!)));
  });
  app.get('/api/admin/artwork', guarded, async (request) => {
    const value = await service.listArtwork(pageQuery.parse(request.query));
    return success({ ...value, data: value.data.map(toAdminArtwork) });
  });
  app.get('/api/admin/artwork/slug/:slug', guarded, async (request) =>
    success(toAdminArtwork(await service.getArtworkBySlug(slugParams.parse(request.params).slug))),
  );
  app.get('/api/admin/artwork/:id', guarded, async (request) =>
    success(toAdminArtwork(await service.getArtworkById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/artwork/:id', guarded, async (request) =>
    success(
      toAdminArtwork(
        await service.updateArtwork(
          idParams.parse(request.params).id,
          updateArtworkSchema.parse(request.body),
        )!,
      ),
    ),
  );
  app.post('/api/admin/artwork/:id/archive', guarded, async (request) =>
    success(toAdminArtwork(await service.archiveArtwork(idParams.parse(request.params).id))),
  );

  app.post('/api/admin/products', guarded, async (request, reply) => {
    const body = z
      .object({
        product: createProductSchema,
        categoryIds: z.array(idSchema).default([]),
        collectionIds: z.array(idSchema).default([]),
      })
      .parse(request.body);
    const value = await service.createProduct(body.product, body.categoryIds, body.collectionIds);
    return reply.status(201).send(success(toAdminProduct(value!)));
  });
  app.get('/api/admin/products', guarded, async (request) => {
    const value = await service.listProducts(request.query);
    return success({ ...value, data: value.data.map(toAdminProduct) });
  });
  app.get('/api/admin/products/slug/:slug', guarded, async (request) =>
    success(toAdminProduct(await service.getProductBySlug(slugParams.parse(request.params).slug))),
  );
  app.get('/api/admin/products/:id', guarded, async (request) =>
    success(toAdminProduct(await service.getProductById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/products/:id', guarded, async (request) =>
    success(
      toAdminProduct(
        await service.updateProduct(
          idParams.parse(request.params).id,
          updateProductSchema.parse(request.body),
        )!,
      ),
    ),
  );
  app.post('/api/admin/products/:id/activate', guarded, async (request) =>
    success(
      toAdminProduct(
        (await service.updateProduct(idParams.parse(request.params).id, { status: 'ACTIVE' }))!,
      ),
    ),
  );
  app.post('/api/admin/products/:id/archive', guarded, async (request) =>
    success(toAdminProduct(await service.archiveProduct(idParams.parse(request.params).id))),
  );
  app.post('/api/admin/products/:id/categories', guarded, async (request) => {
    const id = idParams.parse(request.params).id;
    await service.setProductCategories(id, relationsBody.parse(request.body).ids);
    return success(toAdminProduct(await service.getProductById(id)));
  });
  app.delete('/api/admin/products/:id/categories/:categoryId', guarded, async (request) => {
    const params = productCategoryParams.parse(request.params);
    const current = await service.getProductById(params.id);
    await service.setProductCategories(
      params.id,
      current.categories
        .filter((item) => item.categoryId !== params.categoryId)
        .map((item) => item.categoryId),
    );
    return success(toAdminProduct(await service.getProductById(params.id)));
  });
  app.post('/api/admin/products/:id/collections', guarded, async (request) => {
    const id = idParams.parse(request.params).id;
    await service.setProductCollections(id, relationsBody.parse(request.body).ids);
    return success(toAdminProduct(await service.getProductById(id)));
  });
  app.delete('/api/admin/products/:id/collections/:collectionId', guarded, async (request) => {
    const params = productCollectionParams.parse(request.params);
    const current = await service.getProductById(params.id);
    await service.setProductCollections(
      params.id,
      current.collections
        .filter((item) => item.collectionId !== params.collectionId)
        .map((item) => item.collectionId),
    );
    return success(toAdminProduct(await service.getProductById(params.id)));
  });

  app.post('/api/admin/products/:productId/variants', guarded, async (request, reply) =>
    reply
      .status(201)
      .send(
        success(
          toAdminVariant(
            (await service.createVariant(
              productParams.parse(request.params).productId,
              createVariantSchema.parse(request.body),
            ))!,
          ),
        ),
      ),
  );
  app.get('/api/admin/products/:productId/variants', guarded, async (request) =>
    success(
      (await service.listVariantsForProduct(productParams.parse(request.params).productId)).map(
        toAdminVariant,
      ),
    ),
  );
  app.get('/api/admin/variants/:id', guarded, async (request) =>
    success(toAdminVariant(await service.getVariantById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/variants/:id', guarded, async (request) =>
    success(
      toAdminVariant(
        await service.updateVariant(
          idParams.parse(request.params).id,
          updateVariantSchema.parse(request.body),
        ),
      ),
    ),
  );
  app.post('/api/admin/variants/:id/activate', guarded, async (request) =>
    success(
      toAdminVariant(
        await service.updateVariant(idParams.parse(request.params).id, { isActive: true }),
      ),
    ),
  );
  app.post('/api/admin/variants/:id/archive', guarded, async (request) =>
    success(toAdminVariant(await service.archiveVariant(idParams.parse(request.params).id))),
  );

  app.post('/api/admin/media', guarded, async (request, reply) => {
    const value = await service.createMedia(createMediaSchema.parse(request.body));
    return reply.status(201).send(success(toAdminMedia(value!)));
  });
  app.get('/api/admin/media/:id', guarded, async (request) =>
    success(toAdminMedia(await service.getMediaById(idParams.parse(request.params).id))),
  );
  app.patch('/api/admin/media/:id', guarded, async (request) =>
    success(
      toAdminMedia(
        await service.updateMedia(
          idParams.parse(request.params).id,
          updateMediaSchema.parse(request.body),
        )!,
      ),
    ),
  );
  app.delete('/api/admin/media/:id', guarded, async (request, reply) => {
    await service.deleteMedia(idParams.parse(request.params).id);
    return reply.status(204).send();
  });
  app.get('/api/admin/products/:productId/media', guarded, async (request) =>
    success(
      (await service.listMediaForProduct(productParams.parse(request.params).productId)).map(
        toAdminMedia,
      ),
    ),
  );
  app.get('/api/admin/variants/:variantId/media', guarded, async (request) =>
    success(
      (await service.listMediaForVariant(variantParams.parse(request.params).variantId)).map(
        toAdminMedia,
      ),
    ),
  );
  app.get('/api/admin/artwork/:artworkId/media', guarded, async (request) =>
    success(
      (await service.listMediaForArtwork(artworkParams.parse(request.params).artworkId)).map(
        toAdminMedia,
      ),
    ),
  );

  app.get('/api/admin/variants/:variantId/inventory', guarded, async (request) =>
    success(
      toAdminInventory(
        await service.getInventoryForVariant(variantParams.parse(request.params).variantId),
      ),
    ),
  );
  app.post('/api/admin/variants/:variantId/inventory/adjust', guarded, async (request) => {
    const body = inventoryAdjustmentBody.parse(request.body);
    const result = await service.adjustInventory(
      { ...body, variantId: variantParams.parse(request.params).variantId },
      request.authUser?.id,
    );
    return success({
      inventory: toAdminInventory(result.inventory),
      adjustment: toAdminAdjustment(result.adjustment),
    });
  });
  app.get('/api/admin/variants/:variantId/inventory/adjustments', guarded, async (request) => {
    const result = await service.listInventoryAdjustments(
      variantParams.parse(request.params).variantId,
      pageQuery.parse(request.query),
    );
    return success({ ...result, data: result.data.map(toAdminAdjustment) });
  });
}
