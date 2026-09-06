import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (
  new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid').pathname !==
  '/boss_website_test'
)
  throw new Error('Public catalog tests require boss_website_test.');
const { buildApp } = await import('../src/app.js');
const { prisma } = await import('@boss/database');
const app = buildApp();
const suffix = `${Date.now()}`;
let activeId = '';
let secondActiveId = '';
let draftId = '';
let archivedId = '';
let categoryId = '';
let categorySlug = '';
let collectionId = '';
let collectionSlug = '';
let hiddenCategoryId = '';
let hiddenCollectionId = '';
beforeAll(async () => {
  await app.ready();
  const category = await prisma.category.create({
    data: { name: 'Public', slug: `public-${suffix}` },
  });
  const collection = await prisma.collection.create({
    data: { name: 'Public', slug: `collection-${suffix}`, status: 'ACTIVE' },
  });
  const hiddenCategory = await prisma.category.create({
    data: { name: 'Hidden', slug: `hidden-${suffix}`, isActive: false },
  });
  const hiddenCollection = await prisma.collection.create({
    data: { name: 'Hidden', slug: `hidden-collection-${suffix}`, status: 'DRAFT' },
  });
  categoryId = category.id;
  categorySlug = category.slug;
  collectionId = collection.id;
  collectionSlug = collection.slug;
  hiddenCategoryId = hiddenCategory.id;
  hiddenCollectionId = hiddenCollection.id;
  const create = async (
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED',
    slug: string,
    options: { name?: string; pricePaise?: number; skuSuffix?: string } = {},
  ) =>
    prisma.product.create({
      data: {
        name: options.name ?? status,
        slug,
        productType: 'POSTER',
        status,
        categories: { create: { categoryId: category.id } },
        collections: { create: { collectionId: collection.id } },
        variants: {
          create: {
            sku: `${status}-${suffix}${options.skuSuffix ?? ''}`,
            name: 'A4',
            attributes: { size: 'A4' },
            pricePaise: options.pricePaise ?? 1000,
            inventory: { create: { available: 2 } },
          },
        },
        media: {
          create: {
            scope: 'PUBLIC_PRODUCT',
            storageKey: `public-${slug}`,
            url: 'https://example.test/p.jpg',
            mimeType: 'image/jpeg',
          },
        },
      },
      include: { variants: true },
    });
  activeId = (await create('ACTIVE', `active-${suffix}`)).id;
  secondActiveId = (
    await create('ACTIVE', `active-second-${suffix}`, {
      name: 'Public secondary',
      pricePaise: 2000,
      skuSuffix: '-SECOND',
    })
  ).id;
  draftId = (await create('DRAFT', `draft-${suffix}`)).id;
  archivedId = (await create('ARCHIVED', `archived-${suffix}`)).id;
  await prisma.productCategory.create({
    data: { productId: activeId, categoryId: hiddenCategory.id },
  });
  await prisma.productCollection.create({
    data: { productId: activeId, collectionId: hiddenCollection.id },
  });
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
describe('Public catalog API', () => {
  it('serves only public records with validated pagination and projections', async () => {
    const list = await app.inject(
      `/api/catalog/products?category=${categorySlug}&collection=${collectionSlug}&page=1&limit=100&sortBy=name&sortOrder=asc`,
    );
    expect(list.statusCode).toBe(200);
    expect(list.json().data.meta).toMatchObject({ page: 1, limit: 100 });
    expect(list.json().data.data.some((p: { id: string }) => p.id === activeId)).toBe(true);
    expect(list.json().data.data.some((p: { id: string }) => p.id === secondActiveId)).toBe(true);
    expect(
      list.json().data.data.some((p: { id: string }) => p.id === draftId || p.id === archivedId),
    ).toBe(false);
    const detail = await app.inject(`/api/catalog/products/${activeId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data).not.toHaveProperty('status');
    expect(detail.json().data).not.toHaveProperty('internalNotes');
    expect(detail.json().data).not.toHaveProperty('artworkId');
    expect(detail.json().data).not.toHaveProperty('inventory');
    expect(detail.json().data.variants[0]).not.toHaveProperty('sku');
    expect(detail.json().data.media[0]).not.toHaveProperty('storageKey');
    expect(detail.json().data.categories).toEqual([expect.objectContaining({ id: categoryId })]);
    expect(detail.json().data.collections).toEqual([expect.objectContaining({ id: collectionId })]);
    expect((await app.inject(`/api/catalog/products/${draftId}`)).statusCode).toBe(404);
    expect((await app.inject(`/api/catalog/products/${archivedId}`)).statusCode).toBe(404);
    const invalidLimit = await app.inject('/api/catalog/products?limit=101');
    expect(invalidLimit.statusCode).toBe(400);
    expect(invalidLimit.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(JSON.stringify(invalidLimit.json())).not.toMatch(/prisma|stack|sql/i);
    expect((await app.inject('/api/catalog/products?page=0')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products?limit=not-a-number')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products?sortBy=sql')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products?sortOrder=sideways')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products?category=INVALID')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products/cinvalid')).statusCode).toBe(400);
    expect((await app.inject('/api/catalog/products/cmissing12345')).statusCode).toBe(404);
  });
  it('serves public category, collection, variants and media without authentication', async () => {
    const defaultList = await app.inject('/api/catalog/products');
    expect(defaultList.statusCode).toBe(200);
    expect(defaultList.json().data.meta).toMatchObject({ page: 1, limit: 20 });
    const pagedList = await app.inject(
      `/api/catalog/products?category=${categorySlug}&page=2&limit=1&sortBy=price&sortOrder=desc`,
    );
    expect(pagedList.statusCode).toBe(200);
    expect(pagedList.json().data.meta).toMatchObject({ page: 2, limit: 1 });
    const categoryFiltered = await app.inject(`/api/catalog/products?category=${categorySlug}`);
    expect(categoryFiltered.statusCode).toBe(200);
    expect(categoryFiltered.json().data.data.map((value: { id: string }) => value.id)).toEqual(
      expect.arrayContaining([activeId, secondActiveId]),
    );
    const collectionFiltered = await app.inject(
      `/api/catalog/products?collection=${collectionSlug}`,
    );
    expect(collectionFiltered.statusCode).toBe(200);
    expect(collectionFiltered.json().data.data.map((value: { id: string }) => value.id)).toEqual(
      expect.arrayContaining([activeId, secondActiveId]),
    );
    const sorted = await app.inject(
      `/api/catalog/products?category=${categorySlug}&sortBy=price&sortOrder=asc`,
    );
    expect(sorted.statusCode).toBe(200);
    const sortedIds = sorted.json().data.data.map((value: { id: string }) => value.id);
    expect(sortedIds.indexOf(activeId)).toBeLessThan(sortedIds.indexOf(secondActiveId));
    const emptyList = await app.inject('/api/catalog/products?collection=empty-collection');
    expect(emptyList.statusCode).toBe(200);
    expect(emptyList.json().data.data).toEqual([]);
    const categories = await app.inject('/api/catalog/categories?limit=100');
    expect(categories.statusCode).toBe(200);
    expect(
      categories.json().data.data.some((value: { id: string }) => value.id === categoryId),
    ).toBe(true);
    expect(
      categories.json().data.data.some((value: { id: string }) => value.id === hiddenCategoryId),
    ).toBe(false);
    expect(
      categories.json().data.data.find((value: { id: string }) => value.id === categoryId),
    ).not.toHaveProperty('isActive');
    expect((await app.inject(`/api/catalog/categories/${categoryId}`)).statusCode).toBe(200);
    expect((await app.inject(`/api/catalog/categories/${hiddenCategoryId}`)).statusCode).toBe(404);
    expect((await app.inject('/api/catalog/categories/cmissing12345')).statusCode).toBe(404);
    const collections = await app.inject('/api/catalog/collections?limit=100');
    expect(collections.statusCode).toBe(200);
    expect(
      collections.json().data.data.some((value: { id: string }) => value.id === collectionId),
    ).toBe(true);
    expect(
      collections.json().data.data.some((value: { id: string }) => value.id === hiddenCollectionId),
    ).toBe(false);
    expect(
      collections.json().data.data.find((value: { id: string }) => value.id === collectionId),
    ).not.toHaveProperty('status');
    expect((await app.inject(`/api/catalog/collections/${collectionId}`)).statusCode).toBe(200);
    expect((await app.inject(`/api/catalog/collections/${hiddenCollectionId}`)).statusCode).toBe(
      404,
    );
    expect((await app.inject('/api/catalog/collections/cmissing12345')).statusCode).toBe(404);
    const variants = await app.inject(`/api/catalog/products/${activeId}/variants`);
    expect(variants.statusCode).toBe(200);
    expect(variants.json().data[0]).not.toHaveProperty('sku');
    expect(variants.json().data[0]).not.toHaveProperty('productId');
    expect(variants.json().data[0]).not.toHaveProperty('inventoryPolicy');
    expect(variants.json().data[0]).toMatchObject({
      name: 'A4',
      attributes: { size: 'A4' },
      price: { amountMinor: 1000, currency: 'INR' },
    });
    const media = await app.inject(`/api/catalog/products/${activeId}/media`);
    expect(media.statusCode).toBe(200);
    expect(media.json().data[0]).not.toHaveProperty('storageKey');
    expect(media.json().data[0]).not.toHaveProperty('storageProvider');
    expect(media.json().data[0]).not.toHaveProperty('checksum');
    expect(media.json().data[0]).not.toHaveProperty('metadata');
    expect(media.json().data[0]).toMatchObject({
      url: 'https://example.test/p.jpg',
      purpose: 'GALLERY',
    });
  });
});
