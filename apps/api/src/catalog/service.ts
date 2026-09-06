import { Prisma, type PrismaClient } from '@boss/database';
import {
  createArtworkSchema,
  createCategorySchema,
  createCollectionSchema,
  createInventoryAdjustmentSchema,
  createMediaSchema,
  createProductSchema,
  categoryListQuerySchema,
  productListQuerySchema,
  createVariantSchema,
  updateArtworkSchema,
  updateCategorySchema,
  updateCollectionSchema,
  updateMediaSchema,
  updateProductSchema,
  updateVariantSchema,
} from '@boss/contracts';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

type Page = { page?: number; limit?: number };
const lifecycle = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
} as const;
const parse = <T extends z.ZodTypeAny>(schema: T, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data.');
  return result.data;
};
const page = ({ page: current = 1, limit = 20 }: Page) => ({
  skip: (current - 1) * limit,
  take: limit,
});
const prismaError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    throw new AppError(409, 'CONFLICT', 'A record with this unique value already exists.');
  throw error;
};

export class CatalogService {
  constructor(private readonly db: PrismaClient) {}
  private async entity<T>(value: T | null, label: string): Promise<T> {
    if (!value) throw new AppError(404, 'NOT_FOUND', `${label} was not found.`);
    return value;
  }
  private async transition(current: keyof typeof lifecycle, next: keyof typeof lifecycle) {
    if (current !== next && !lifecycle[current].includes(next as never))
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid lifecycle transition.');
  }
  async createCategory(input: unknown) {
    const data = parse(createCategorySchema, input);
    if (data.parentId)
      await this.entity(
        await this.db.category.findUnique({ where: { id: data.parentId } }),
        'Parent category',
      );
    try {
      return await this.db.category.create({ data });
    } catch (e) {
      prismaError(e);
    }
  }
  async getCategoryById(id: string) {
    return this.entity(await this.db.category.findUnique({ where: { id } }), 'Category');
  }
  async getCategoryBySlug(slug: string) {
    return this.entity(await this.db.category.findUnique({ where: { slug } }), 'Category');
  }
  async getPublicCategoryById(id: string) {
    return this.entity(
      await this.db.category.findFirst({ where: { id, isActive: true } }),
      'Category',
    );
  }
  async listCategories(query: Page = {}) {
    const parsed = parse(categoryListQuerySchema, query);
    const { skip, take } = page(parsed);
    const where = {
      ...(parsed.parentId ? { parentId: parsed.parentId } : {}),
      ...(parsed.isActive === undefined ? {} : { isActive: parsed.isActive }),
      ...(parsed.search
        ? {
            OR: [
              { name: { contains: parsed.search, mode: 'insensitive' as const } },
              { slug: { contains: parsed.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.category.findMany({
        skip,
        take,
        where,
        orderBy: { [parsed.sortBy]: parsed.sortOrder },
      }),
      this.db.category.count({ where }),
    ]);
    return {
      data,
      meta: { page: parsed.page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async listPublicCategories(query: unknown = {}) {
    const parsed = parse(categoryListQuerySchema, { ...(query as object), isActive: true });
    return this.listCategories(parsed);
  }
  async updateCategory(id: string, input: unknown) {
    const data = parse(updateCategorySchema, input);
    const category = await this.getCategoryById(id);
    if (data.parentId) {
      if (data.parentId === id)
        throw new AppError(400, 'VALIDATION_ERROR', 'A category cannot be its own parent.');
      let parent = await this.getCategoryById(data.parentId);
      while (parent.parentId) {
        if (parent.parentId === id)
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A category cannot be moved beneath its descendant.',
          );
        parent = await this.getCategoryById(parent.parentId);
      }
    }
    try {
      return await this.db.category.update({ where: { id: category.id }, data });
    } catch (e) {
      prismaError(e);
    }
  }
  async archiveCategory(id: string) {
    await this.getCategoryById(id);
    return this.db.category.update({ where: { id }, data: { isActive: false } });
  }
  async createCollection(input: unknown) {
    const data = parse(createCollectionSchema, input);
    try {
      return await this.db.collection.create({ data });
    } catch (e) {
      prismaError(e);
    }
  }
  async getCollectionById(id: string) {
    return this.entity(await this.db.collection.findUnique({ where: { id } }), 'Collection');
  }
  async getCollectionBySlug(slug: string) {
    return this.entity(await this.db.collection.findUnique({ where: { slug } }), 'Collection');
  }
  async listCollections(query: Page = {}) {
    const { skip, take } = page(query);
    const [data, total] = await this.db.$transaction([
      this.db.collection.findMany({ skip, take, orderBy: { sortOrder: 'asc' } }),
      this.db.collection.count(),
    ]);
    return {
      data,
      meta: { page: query.page ?? 1, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async getPublicCollectionById(id: string) {
    return this.entity(
      await this.db.collection.findFirst({ where: { id, isActive: true, status: 'ACTIVE' } }),
      'Collection',
    );
  }
  async listPublicCollections(query: Page = {}) {
    const { skip, take } = page(query);
    const where = { isActive: true, status: 'ACTIVE' as const };
    const [data, total] = await this.db.$transaction([
      this.db.collection.findMany({ where, skip, take, orderBy: { sortOrder: 'asc' } }),
      this.db.collection.count({ where }),
    ]);
    return {
      data,
      meta: { page: query.page ?? 1, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async updateCollection(id: string, input: unknown) {
    await this.getCollectionById(id);
    const data = parse(updateCollectionSchema, input);
    try {
      return await this.db.collection.update({ where: { id }, data });
    } catch (e) {
      prismaError(e);
    }
  }
  async archiveCollection(id: string) {
    await this.getCollectionById(id);
    return this.db.collection.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false },
    });
  }
  async createArtwork(input: unknown) {
    const data = parse(createArtworkSchema, input);
    try {
      return await this.db.artwork.create({ data });
    } catch (e) {
      prismaError(e);
    }
  }
  async getArtworkById(id: string) {
    return this.entity(await this.db.artwork.findUnique({ where: { id } }), 'Artwork');
  }
  async getArtworkBySlug(slug: string) {
    return this.entity(await this.db.artwork.findUnique({ where: { slug } }), 'Artwork');
  }
  async listArtwork(query: Page = {}) {
    const { skip, take } = page(query);
    const [data, total] = await this.db.$transaction([
      this.db.artwork.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.db.artwork.count(),
    ]);
    return {
      data,
      meta: { page: query.page ?? 1, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async updateArtwork(id: string, input: unknown) {
    await this.getArtworkById(id);
    const data = parse(updateArtworkSchema, input);
    try {
      return await this.db.artwork.update({ where: { id }, data });
    } catch (e) {
      prismaError(e);
    }
  }
  async archiveArtwork(id: string) {
    await this.getArtworkById(id);
    return this.db.artwork.update({ where: { id }, data: { status: 'ARCHIVED', isActive: false } });
  }
  async createProduct(input: unknown, categoryIds: string[] = [], collectionIds: string[] = []) {
    const data = parse(createProductSchema, input);
    if (data.artworkId) await this.getArtworkById(data.artworkId);
    await Promise.all(categoryIds.map((id) => this.getCategoryById(id)));
    await Promise.all(collectionIds.map((id) => this.getCollectionById(id)));
    try {
      return await this.db.product.create({
        data: {
          ...data,
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
          collections: { create: collectionIds.map((collectionId) => ({ collectionId })) },
        },
        include: {
          artwork: true,
          variants: { include: { inventory: true } },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
          media: true,
        },
      });
    } catch (e) {
      prismaError(e);
    }
  }
  async getProductById(id: string) {
    return this.entity(
      await this.db.product.findUnique({
        where: { id },
        include: {
          artwork: true,
          variants: { include: { inventory: true } },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
          media: true,
        },
      }),
      'Product',
    );
  }
  async getProductBySlug(slug: string) {
    return this.entity(
      await this.db.product.findUnique({
        where: { slug },
        include: {
          artwork: true,
          variants: { include: { inventory: true } },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
          media: true,
        },
      }),
      'Product',
    );
  }
  async getPublicProductById(id: string) {
    return this.entity(
      await this.db.product.findFirst({
        where: { id, status: 'ACTIVE' },
        include: {
          variants: { include: { inventory: true } },
          categories: {
            where: { category: { isActive: true } },
            include: { category: true },
          },
          collections: {
            where: { collection: { isActive: true, status: 'ACTIVE' } },
            include: { collection: true },
          },
          media: { where: { deletedAt: null } },
        },
      }),
      'Product',
    );
  }
  async listPublicProducts(query: unknown = {}) {
    const parsed = parse(productListQuerySchema, { ...(query as object), status: 'ACTIVE' });
    return this.listProducts(parsed, true);
  }
  async listProducts(query: unknown = {}, publicOnly = false) {
    const parsed = parse(productListQuerySchema, query);
    const { skip, take } = page(parsed);
    const where = {
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.productType ? { productType: parsed.productType } : {}),
      ...(parsed.category
        ? {
            categories: {
              some: {
                category: {
                  slug: parsed.category,
                  ...(publicOnly ? { isActive: true } : {}),
                },
              },
            },
          }
        : {}),
      ...(parsed.collection
        ? {
            collections: {
              some: {
                collection: {
                  slug: parsed.collection,
                  ...(publicOnly ? { isActive: true, status: 'ACTIVE' as const } : {}),
                },
              },
            },
          }
        : {}),
    };
    const include = {
      variants: { include: { inventory: true } },
      categories: publicOnly
        ? { where: { category: { isActive: true } }, include: { category: true } }
        : { include: { category: true } },
      collections: publicOnly
        ? {
            where: { collection: { isActive: true, status: 'ACTIVE' as const } },
            include: { collection: true },
          }
        : { include: { collection: true } },
      media: { where: { deletedAt: null } },
    };
    if (parsed.sortBy === 'price') {
      const data = await this.db.product.findMany({ where, include });
      const price = (product: (typeof data)[number]) =>
        Math.min(
          ...product.variants
            .filter((variant) => variant.isActive)
            .map((variant) => variant.pricePaise),
          Number.POSITIVE_INFINITY,
        );
      data.sort((left, right) =>
        parsed.sortOrder === 'asc' ? price(left) - price(right) : price(right) - price(left),
      );
      const total = data.length;
      return {
        data: data.slice(skip, skip + take),
        meta: { page: parsed.page, limit: take, total, totalPages: Math.ceil(total / take) },
      };
    }
    const orderBy = { [parsed.sortBy]: parsed.sortOrder };
    const [data, total] = await this.db.$transaction([
      this.db.product.findMany({ where, skip, take, orderBy, include }),
      this.db.product.count({ where }),
    ]);
    return {
      data,
      meta: { page: parsed.page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async updateProduct(id: string, input: unknown) {
    const existing = await this.getProductById(id);
    const data = parse(updateProductSchema, input);
    if (data.status) {
      await this.transition(existing.status, data.status);
      if (
        data.status === 'ACTIVE' &&
        !existing.variants.some((v) => v.isActive && v.pricePaise >= 0)
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'An active product requires an active priced variant.',
        );
    }
    if (data.artworkId) await this.getArtworkById(data.artworkId);
    try {
      return await this.db.product.update({ where: { id }, data });
    } catch (e) {
      prismaError(e);
    }
  }
  async archiveProduct(id: string) {
    const product = await this.getProductById(id);
    await this.transition(product.status, 'ARCHIVED');
    return this.db.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }
  async setProductCategories(productId: string, categoryIds: string[]) {
    await this.getProductById(productId);
    await Promise.all(categoryIds.map((id) => this.getCategoryById(id)));
    return this.db.$transaction(async (tx) => {
      await tx.productCategory.deleteMany({ where: { productId } });
      return tx.productCategory.createMany({
        data: categoryIds.map((categoryId) => ({ productId, categoryId })),
      });
    });
  }
  async setProductCollections(productId: string, collectionIds: string[]) {
    await this.getProductById(productId);
    await Promise.all(collectionIds.map((id) => this.getCollectionById(id)));
    return this.db.$transaction(async (tx) => {
      await tx.productCollection.deleteMany({ where: { productId } });
      return tx.productCollection.createMany({
        data: collectionIds.map((collectionId) => ({ productId, collectionId })),
      });
    });
  }
  async createVariant(productId: string, input: unknown) {
    const product = await this.getProductById(productId);
    if (product.status === 'ARCHIVED')
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot add a variant to an archived product.');
    const data = parse(createVariantSchema, input);
    if (data.compareAtPricePaise != null && data.compareAtPricePaise < data.pricePaise)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Compare-at price must not be below selling price.',
      );
    try {
      return await this.db.productVariant.create({
        data: {
          productId,
          sku: data.sku,
          name: data.name,
          attributes: data.attributes,
          pricePaise: data.pricePaise,
          compareAtPricePaise: data.compareAtPricePaise,
          currency: data.currency,
          isActive: data.isActive,
          inventoryPolicy: data.inventoryPolicy,
          inventory: { create: { available: 0 } },
        },
        include: { inventory: true },
      });
    } catch (e) {
      prismaError(e);
    }
  }
  async getVariantById(id: string) {
    return this.entity(
      await this.db.productVariant.findUnique({
        where: { id },
        include: { inventory: true, product: true },
      }),
      'Variant',
    );
  }
  async listVariantsForProduct(productId: string) {
    await this.getProductById(productId);
    return this.db.productVariant.findMany({
      where: { productId },
      include: { inventory: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  async updateVariant(id: string, input: unknown) {
    await this.getVariantById(id);
    const data = parse(updateVariantSchema, input);
    if (
      data.compareAtPricePaise != null &&
      data.pricePaise != null &&
      data.compareAtPricePaise < data.pricePaise
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Compare-at price must not be below selling price.',
      );
    return this.db.productVariant.update({ where: { id }, data });
  }
  async archiveVariant(id: string) {
    await this.getVariantById(id);
    return this.db.productVariant.update({ where: { id }, data: { isActive: false } });
  }
  async getInventoryForVariant(variantId: string) {
    const variant = await this.getVariantById(variantId);
    return this.entity(variant.inventory, 'Variant inventory');
  }
  async listInventoryAdjustments(variantId: string, query: Page = {}) {
    const inventory = await this.getInventoryForVariant(variantId);
    const { skip, take } = page(query);
    const [data, total] = await this.db.$transaction([
      this.db.inventoryAdjustment.findMany({
        where: { inventoryId: inventory.id },
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      this.db.inventoryAdjustment.count({ where: { inventoryId: inventory.id } }),
    ]);
    return {
      data,
      meta: { page: query.page ?? 1, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
  async adjustInventory(input: unknown, actorId?: string) {
    const data = parse(createInventoryAdjustmentSchema, input);
    return this.db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: data.variantId },
        include: { inventory: true },
      });
      if (!variant?.inventory)
        throw new AppError(404, 'NOT_FOUND', 'Variant inventory was not found.');
      const updated = await tx.inventory.updateMany({
        where: {
          id: variant.inventory.id,
          ...(data.delta < 0 ? { available: { gte: -data.delta } } : {}),
        },
        data: { available: { increment: data.delta } },
      });
      if (updated.count !== 1) throw new AppError(409, 'CONFLICT', 'Insufficient inventory.');
      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { id: variant.inventory.id },
      });
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inventory.id,
          delta: data.delta,
          reason: data.reason,
          actorId: actorId ?? null,
          referenceId: data.referenceId ?? null,
          note: data.note ?? null,
        },
      });
      return { inventory, adjustment };
    });
  }
  private async validateMediaRelations(data: {
    artworkId?: string | null;
    productId?: string | null;
    variantId?: string | null;
    categoryId?: string | null;
    collectionId?: string | null;
  }) {
    if (data.artworkId) await this.getArtworkById(data.artworkId);
    if (data.productId) await this.getProductById(data.productId);
    if (data.categoryId) await this.getCategoryById(data.categoryId);
    if (data.collectionId) await this.getCollectionById(data.collectionId);
    if (data.variantId) {
      const variant = await this.getVariantById(data.variantId);
      if (data.productId && variant.productId !== data.productId)
        throw new AppError(400, 'VALIDATION_ERROR', 'The variant does not belong to the product.');
    }
  }
  async createMedia(input: unknown) {
    const data = parse(createMediaSchema, input);
    await this.validateMediaRelations(data);
    try {
      return await this.db.media.create({ data });
    } catch (e) {
      return prismaError(e);
    }
  }
  async getMediaById(id: string) {
    return this.entity(await this.db.media.findFirst({ where: { id, deletedAt: null } }), 'Media');
  }
  async listMediaForProduct(productId: string) {
    await this.getProductById(productId);
    return this.db.media.findMany({
      where: { productId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async listMediaForVariant(variantId: string) {
    await this.getVariantById(variantId);
    return this.db.media.findMany({
      where: { variantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async listMediaForArtwork(artworkId: string) {
    await this.getArtworkById(artworkId);
    return this.db.media.findMany({
      where: { artworkId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async updateMedia(id: string, input: unknown) {
    await this.getMediaById(id);
    const data = parse(updateMediaSchema, input);
    await this.validateMediaRelations(data);
    try {
      return await this.db.media.update({ where: { id }, data });
    } catch (e) {
      return prismaError(e);
    }
  }
  async deleteMedia(id: string) {
    await this.getMediaById(id);
    return this.db.media.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
