import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const databaseName = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid').pathname;
if (databaseName !== '/boss_website_test') {
  throw new Error('Catalog service tests require the isolated boss_website_test database.');
}

const { prisma } = await import('@boss/database');
const { CatalogService } = await import('../src/catalog/service.js');
const { toPublicArtwork, toPublicProduct } = await import('../src/catalog/public-projections.js');
const service = new CatalogService(prisma);
const suffix = `${Date.now()}`;
const slug = (name: string) => `test-${name}-${suffix}`;

beforeEach(async () => {
  await prisma.inventoryAdjustment.deleteMany({
    where: { referenceId: { startsWith: `test-${suffix}` } },
  });
  await prisma.media.deleteMany({ where: { storageKey: { startsWith: `test-${suffix}` } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: `test-` } } });
  await prisma.artwork.deleteMany({ where: { slug: { startsWith: `test-` } } });
  await prisma.collection.deleteMany({ where: { slug: { startsWith: `test-` } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: `test-` } } });
});
afterAll(async () => prisma.$disconnect());

describe('CatalogService', () => {
  it('protects category hierarchy and maps stable domain errors', async () => {
    const root = await service.createCategory({ name: 'Root', slug: slug('root'), sortOrder: 1 });
    const child = await service.createCategory({
      name: 'Child',
      slug: slug('child'),
      parentId: root.id,
      sortOrder: 2,
    });
    await expect(service.createCategory({ name: 'Again', slug: root.slug })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(service.updateCategory(root.id, { parentId: root.id })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.updateCategory(root.id, { parentId: child.id })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      service.createCategory({ name: 'Missing', slug: slug('missing'), parentId: 'cmissing12345' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const listed = await service.listCategories({
      page: 1,
      limit: 1,
      sortBy: 'sortOrder',
      sortOrder: 'asc',
    });
    expect(listed.meta.limit).toBe(1);
    expect(await service.archiveCategory(child.id)).toMatchObject({ isActive: false });
  });

  it('runs the catalog, media, projection, and inventory scenario atomically', async () => {
    const category = await service.createCategory({ name: 'Category', slug: slug('category') });
    const nested = await service.createCategory({
      name: 'Nested',
      slug: slug('nested'),
      parentId: category.id,
    });
    const collection = await service.createCollection({
      name: 'Collection',
      slug: slug('collection'),
    });
    const artwork = await service.createArtwork({
      title: 'Artwork',
      slug: slug('artwork'),
      rightsHolder: 'Internal rights',
      internalNotes: 'Internal note',
    });
    const product = await service.createProduct(
      { name: 'Product', slug: slug('product'), productType: 'POSTER', artworkId: artwork.id },
      [nested.id],
      [collection.id],
    );
    const second = await service.createProduct({
      name: 'Second',
      slug: slug('second'),
      productType: 'POSTER',
      artworkId: artwork.id,
    });
    expect(second.artworkId).toBe(artwork.id);
    const variant = await service.createVariant(product.id, {
      sku: `TEST-SKU-${suffix}`,
      name: 'A4',
      attributes: { size: 'A4' },
      pricePaise: 1000,
      compareAtPricePaise: 1200,
    });
    await expect(
      service.createVariant(product.id, {
        sku: variant.sku,
        name: 'Again',
        attributes: {},
        pricePaise: 1000,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      service.createVariant(product.id, {
        sku: `TEST-LOW-${suffix}`,
        name: 'Bad',
        attributes: {},
        pricePaise: 1000,
        compareAtPricePaise: 999,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await service.adjustInventory({
      variantId: variant.id,
      delta: 10,
      reason: 'INITIAL_STOCK',
      referenceId: `test-${suffix}-initial`,
    });
    await service.adjustInventory({
      variantId: variant.id,
      delta: -3,
      reason: 'CORRECTION',
      referenceId: `test-${suffix}-minus`,
    });
    expect((await service.getInventoryForVariant(variant.id)).available).toBe(7);
    await expect(
      service.adjustInventory({
        variantId: variant.id,
        delta: -8,
        reason: 'CORRECTION',
        referenceId: `test-${suffix}-fail`,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await service.getInventoryForVariant(variant.id)).available).toBe(7);
    expect((await service.listInventoryAdjustments(variant.id)).data).toHaveLength(2);
    const media = await service.createMedia({
      scope: 'PUBLIC_PRODUCT',
      purpose: 'THUMBNAIL',
      storageKey: `test-${suffix}-thumbnail`,
      url: 'https://example.test/image.jpg',
      mimeType: 'image/jpeg',
      productId: product.id,
      variantId: variant.id,
      artworkId: artwork.id,
      sortOrder: 1,
    });
    expect(await service.listMediaForProduct(product.id)).toHaveLength(1);
    expect(await service.listMediaForVariant(variant.id)).toHaveLength(1);
    expect(await service.listMediaForArtwork(artwork.id)).toHaveLength(1);
    await expect(
      service.createMedia({
        scope: 'PUBLIC_PRODUCT',
        storageKey: `test-${suffix}-invalid`,
        url: 'https://example.test/x.jpg',
        mimeType: 'image/jpeg',
        productId: second.id,
        variantId: variant.id,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await service.updateMedia(media.id, { altText: 'Thumbnail', sortOrder: 0 });
    await service.updateProduct(product.id, { status: 'ACTIVE' });
    const loaded = await service.getProductById(product.id);
    const publicProduct = toPublicProduct(loaded);
    expect(publicProduct.variants[0]?.price.amountMinor).toBe(1000);
    expect(publicProduct.available).toBe(true);
    const publicArtwork = toPublicArtwork(artwork);
    expect(publicArtwork).not.toHaveProperty('rightsHolder');
    expect(publicArtwork).not.toHaveProperty('internalNotes');
    await service.deleteMedia(media.id);
    await expect(service.getMediaById(media.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('handles collection and product archival without destructive deletion', async () => {
    const collection = await service.createCollection({
      name: 'Collection',
      slug: slug('archive-collection'),
    });
    expect(await service.updateCollection(collection.id, { name: 'Renamed' })).toMatchObject({
      name: 'Renamed',
    });
    expect(await service.archiveCollection(collection.id)).toMatchObject({
      status: 'ARCHIVED',
      isActive: false,
    });
    const product = await service.createProduct({
      name: 'Product',
      slug: slug('archive-product'),
      productType: 'POSTER',
    });
    await service.createVariant(product.id, {
      sku: `TEST-ARCHIVE-${suffix}`,
      name: 'A4',
      attributes: {},
      pricePaise: 100,
    });
    expect(await service.archiveProduct(product.id)).toMatchObject({ status: 'ARCHIVED' });
  });
});
