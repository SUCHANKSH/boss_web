import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (
  new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid').pathname !==
  '/boss_website_test'
)
  throw new Error('Cart tests require boss_website_test.');
const { buildApp } = await import('../src/app.js');
const { prisma } = await import('@boss/database');
const app = buildApp();
const suffix = `${Date.now()}`;
const email = `cart-${suffix}@example.test`;
const password = 'StrongTestPassword123!';
let cookie = '';
let variantId = '';

beforeAll(async () => {
  await app.ready();
  await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password } });
  cookie = (
    await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  ).headers['set-cookie'] as string;
  const product = await prisma.product.create({
    data: {
      name: `Cart product ${suffix}`,
      slug: `cart-product-${suffix}`,
      productType: 'PRINT',
      status: 'ACTIVE',
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `CART-${suffix}`,
      name: 'A3',
      attributes: {},
      pricePaise: 120000,
      inventory: { create: { available: 3 } },
    },
  });
  variantId = variant.id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
const request = (method: string, url: string, payload?: unknown, suppliedCookie = cookie) =>
  app.inject({ method, url, payload, headers: suppliedCookie ? { cookie: suppliedCookie } : {} });

describe('Cart API', () => {
  it('requires an authenticated customer session', async () => {
    expect((await request('GET', '/api/cart', undefined, '')).statusCode).toBe(401);
  });
  it('persists server-priced cart mutations and validates stock', async () => {
    const added = await request('POST', '/api/cart/items', { variantId, quantity: 2 });
    expect(added.statusCode).toBe(200);
    expect(added.json().data.subtotal.amountMinor).toBe(240000);
    const itemId = added.json().data.items[0].id;
    expect((await request('PATCH', `/api/cart/items/${itemId}`, { quantity: 4 })).statusCode).toBe(
      400,
    );
    const updated = await request('PATCH', `/api/cart/items/${itemId}`, { quantity: 3 });
    expect(updated.json().data.itemCount).toBe(3);
    expect((await request('POST', '/api/cart/items', { variantId, quantity: 0 })).statusCode).toBe(
      400,
    );
    expect((await request('DELETE', `/api/cart/items/${itemId}`)).json().data.items).toHaveLength(
      0,
    );
    expect((await request('DELETE', '/api/cart')).statusCode).toBe(200);
  });
});
