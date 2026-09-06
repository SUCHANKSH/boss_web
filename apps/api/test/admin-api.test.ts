import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (
  new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid').pathname !==
  '/boss_website_test'
)
  throw new Error('Admin API tests require boss_website_test.');
const { buildApp } = await import('../src/app.js');
const { prisma } = await import('@boss/database');
const app = buildApp();
const suffix = `${Date.now()}`;
const email = (role: string) => `admin-api-${role.toLowerCase()}-${suffix}@example.test`;
const password = 'StrongTestPassword123!';
let adminCookie = '';
let customerCookie = '';
let superCookie = '';
const request = (method: string, url: string, payload?: unknown, cookie = adminCookie) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

beforeAll(async () => {
  await app.ready();
  for (const role of ['ADMIN', 'CUSTOMER', 'SUPER_ADMIN']) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: email(role), password },
    });
    await prisma.user.upsert({
      where: { email: email(role) },
      update: { role: role as 'ADMIN' },
      create: { email: email(role), role: role as 'ADMIN' },
    });
  }
  const login = async (role: string) =>
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: email(role), password },
      })
    ).headers['set-cookie'] as string;
  adminCookie = await login('ADMIN');
  customerCookie = await login('CUSTOMER');
  superCookie = await login('SUPER_ADMIN');
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('Admin API', () => {
  it('enforces real session roles and logout revocation', async () => {
    expect((await request('GET', '/api/admin/categories', undefined, '')).statusCode).toBe(401);
    expect(
      (await request('GET', '/api/admin/categories', undefined, customerCookie)).statusCode,
    ).toBe(403);
    expect((await request('GET', '/api/admin/categories')).statusCode).toBe(200);
    expect((await request('GET', '/api/admin/categories', undefined, superCookie)).statusCode).toBe(
      200,
    );
    await request('POST', '/api/auth/logout', undefined, adminCookie);
    expect((await request('GET', '/api/admin/categories')).statusCode).toBe(401);
    adminCookie = (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: email('ADMIN'), password },
      })
    ).headers['set-cookie'] as string;
  });
  it('runs catalog CRUD, projection, validation, hierarchy, media and inventory through HTTP', async () => {
    const category = (
      await request('POST', '/api/admin/categories', {
        name: 'Category',
        slug: `admin-category-${suffix}`,
      })
    ).json().data;
    expect(category.createdAt).toEqual(expect.any(String));
    expect(
      (await request('POST', '/api/admin/categories', { name: 'Duplicate', slug: category.slug }))
        .statusCode,
    ).toBe(409);
    expect(
      (await request('PATCH', `/api/admin/categories/${category.id}`, { parentId: category.id }))
        .statusCode,
    ).toBe(400);
    expect((await request('GET', '/api/admin/categories?limit=101')).statusCode).toBe(400);
    const collection = (
      await request('POST', '/api/admin/collections', {
        name: 'Collection',
        slug: `admin-collection-${suffix}`,
      })
    ).json().data;
    const artwork = (
      await request('POST', '/api/admin/artwork', {
        title: 'Artwork',
        slug: `admin-artwork-${suffix}`,
      })
    ).json().data;
    const product = (
      await request('POST', '/api/admin/products', {
        product: {
          name: 'Product',
          slug: `admin-product-${suffix}`,
          productType: 'POSTER',
          artworkId: artwork.id,
        },
        categoryIds: [category.id],
        collectionIds: [collection.id],
      })
    ).json().data;
    expect(
      (await request('GET', `/api/admin/products?status=DRAFT&limit=100`)).json().data.meta.limit,
    ).toBe(100);
    const variant = (
      await request('POST', `/api/admin/products/${product.id}/variants`, {
        sku: `ADMIN-SKU-${suffix}`,
        name: 'A4',
        attributes: {},
        pricePaise: 1000,
      })
    ).json().data;
    expect(variant.price.amountMinor).toBe(1000);
    const media = (
      await request('POST', '/api/admin/media', {
        scope: 'PUBLIC_PRODUCT',
        storageKey: `admin-${suffix}`,
        url: 'https://example.test/a.jpg',
        mimeType: 'image/jpeg',
        productId: product.id,
        variantId: variant.id,
      })
    ).json().data;
    expect(media.storageKey).toBe(`admin-${suffix}`);
    await request('POST', `/api/admin/variants/${variant.id}/inventory/adjust`, {
      delta: 5,
      reason: 'RESTOCK',
    });
    await request('POST', `/api/admin/variants/${variant.id}/inventory/adjust`, {
      delta: -3,
      reason: 'CORRECTION',
    });
    expect(
      (await request('GET', `/api/admin/variants/${variant.id}/inventory`)).json().data.available,
    ).toBe(2);
    expect(
      (
        await request('POST', `/api/admin/variants/${variant.id}/inventory/adjust`, {
          delta: -3,
          reason: 'CORRECTION',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await request('GET', `/api/admin/variants/${variant.id}/inventory/adjustments`)).json().data
        .data,
    ).toHaveLength(2);
    expect((await request('GET', '/api/admin/categories/cinvalid')).statusCode).toBe(400);
    expect((await request('GET', `/api/admin/categories/cmissing12345`)).statusCode).toBe(404);
    expect((await request('DELETE', `/api/admin/media/${media.id}`)).statusCode).toBe(204);
  });
});
