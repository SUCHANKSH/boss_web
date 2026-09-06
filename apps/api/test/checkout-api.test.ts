import { afterAll, beforeAll, describe, expect, it } from 'vitest';
if (
  new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid').pathname !==
  '/boss_website_test'
)
  throw new Error('Checkout tests require boss_website_test.');
const { buildApp } = await import('../src/app.js');
const { CheckoutService } = await import('../src/commerce/checkout-service.js');
const { prisma } = await import('@boss/database');
const app = buildApp();
const suffix = `${Date.now()}`;
const password = 'StrongTestPassword123!';
let cookie = '';
let secondCookie = '';
let variantId = '';
beforeAll(async () => {
  await app.ready();
  const email = `checkout-${suffix}@example.test`;
  await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password } });
  cookie = (
    await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  ).headers['set-cookie'] as string;
  const secondEmail = `checkout-second-${suffix}@example.test`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: secondEmail, password },
  });
  secondCookie = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: secondEmail, password },
    })
  ).headers['set-cookie'] as string;
  const product = await prisma.product.create({
    data: {
      name: `Checkout ${suffix}`,
      slug: `checkout-${suffix}`,
      productType: 'PRINT',
      status: 'ACTIVE',
    },
  });
  variantId = (
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `CHECKOUT-${suffix}`,
        name: 'A3',
        attributes: {},
        pricePaise: 1500,
        inventory: { create: { available: 2 } },
      },
    })
  ).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
const address = {
  recipientName: 'Test Customer',
  phone: '9999999999',
  line1: '1 Test Lane',
  city: 'Mumbai',
  state: 'MH',
  postalCode: '400001',
  countryCode: 'IN',
};
const checkoutData = (key: string) => ({ shippingAddress: address, idempotencyKey: key });
async function fixture(label: string, stock: number, cartQuantity = 1) {
  const user = await prisma.user.create({
    data: { email: `${label}-${suffix}@example.test`, role: 'CUSTOMER' },
  });
  const product = await prisma.product.create({
    data: {
      name: label,
      slug: `${label.toLowerCase()}-${suffix}`,
      productType: 'PRINT',
      status: 'ACTIVE',
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `${label.toUpperCase()}-${suffix}`,
      name: 'A3',
      attributes: {},
      pricePaise: 1000,
      inventory: { create: { available: stock } },
    },
  });
  const cart = await prisma.cart.create({
    data: {
      userId: user.id,
      items: { create: { variantId: variant.id, quantity: cartQuantity, unitPricePaise: 1000 } },
    },
  });
  return { user, variant, cart };
}
describe('Checkout API', () => {
  it('creates one immutable unpaid order and converts the cart idempotently', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/checkout',
          payload: { shippingAddress: address, idempotencyKey: 'a'.repeat(16) },
        })
      ).statusCode,
    ).toBe(401);
    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      payload: { variantId, quantity: 1 },
      headers: { cookie },
    });
    const payload = { shippingAddress: address, idempotencyKey: `checkout-key-${suffix}` };
    const first = await app.inject({
      method: 'POST',
      url: '/api/checkout',
      payload,
      headers: { cookie },
    });
    expect(first.statusCode).toBe(200);
    const order = first.json().data;
    expect(order.total.amountMinor).toBe(1500);
    expect(order.paymentStatus).toBe('PENDING');
    expect(Object.keys(order).sort()).toEqual([
      'createdAt',
      'currency',
      'id',
      'items',
      'number',
      'paymentStatus',
      'shippingAddress',
      'status',
      'subtotal',
      'total',
    ]);
    expect(order.items[0]).toMatchObject({
      productName: `Checkout ${suffix}`,
      variantName: 'A3',
      sku: `CHECKOUT-${suffix}`,
      quantity: 1,
    });
    expect(JSON.stringify(order)).not.toMatch(
      /password|token|session|inventory|providerPayload|storageKey/i,
    );
    const retry = await app.inject({
      method: 'POST',
      url: '/api/checkout',
      payload,
      headers: { cookie },
    });
    expect(retry.json().data.id).toBe(order.id);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).available).toBe(1);
    expect(
      await prisma.inventoryAdjustment.count({
        where: { inventory: { variantId }, reason: 'ORDER_CHECKOUT', referenceId: order.id },
      }),
    ).toBe(1);
    expect(
      (await app.inject({ method: 'GET', url: `/api/orders/${order.id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });
  it('rejects empty checkout without creating commercial state', async () => {
    const before = await prisma.order.count();
    const response = await app.inject({
      method: 'POST',
      url: '/api/checkout',
      payload: { shippingAddress: address, idempotencyKey: `empty-checkout-${suffix}` },
      headers: { cookie: secondCookie },
    });
    expect(response.statusCode).toBe(400);
    expect(await prisma.order.count()).toBe(before);
    expect(
      await prisma.checkoutOperation.count({
        where: { idempotencyKey: `empty-checkout-${suffix}` },
      }),
    ).toBe(0);
  });
  it('isolates order retrieval and idempotency keys by customer', async () => {
    const product = await prisma.product.create({
      data: {
        name: `Isolation ${suffix}`,
        slug: `isolation-${suffix}`,
        productType: 'PRINT',
        status: 'ACTIVE',
      },
    });
    const isolatedVariant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `ISO-${suffix}`,
        name: 'A4',
        attributes: {},
        pricePaise: 900,
        inventory: { create: { available: 2 } },
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      payload: { variantId: isolatedVariant.id, quantity: 1 },
      headers: { cookie: secondCookie },
    });
    const key = `shared-key-${suffix}`;
    const first = await app.inject({
      method: 'POST',
      url: '/api/checkout',
      payload: { shippingAddress: address, idempotencyKey: key },
      headers: { cookie: secondCookie },
    });
    const orderId = first.json().data.id;
    expect(
      (await app.inject({ method: 'GET', url: `/api/orders/${orderId}`, headers: { cookie } }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/checkout',
          payload: { shippingAddress: { ...address, city: 'Pune' }, idempotencyKey: key },
          headers: { cookie: secondCookie },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: isolatedVariant.id } }))
        .available,
    ).toBe(1);
  });
  it('rolls back insufficient inventory and stale pricing failures', async () => {
    const stock = await fixture('stock-failure', 0);
    await expect(
      new CheckoutService(prisma).checkout(stock.user.id, address, `stock-key-${suffix}`),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.order.count({ where: { userId: stock.user.id } })).toBe(0);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: stock.variant.id } }))
        .available,
    ).toBe(0);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: stock.cart.id } })).status).toBe(
      'ACTIVE',
    );
    expect(await prisma.checkoutOperation.count({ where: { userId: stock.user.id } })).toBe(0);
    const stale = await fixture('price-failure', 2);
    await prisma.productVariant.update({
      where: { id: stale.variant.id },
      data: { pricePaise: 1200 },
    });
    await expect(
      new CheckoutService(prisma).checkout(stale.user.id, address, `price-key-${suffix}`),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.order.count({ where: { userId: stale.user.id } })).toBe(0);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: stale.variant.id } }))
        .available,
    ).toBe(2);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: stale.cart.id } })).status).toBe(
      'ACTIVE',
    );
  });
  it('rolls back deterministic post-inventory transaction failure', async () => {
    const data = await fixture('hook-failure', 1);
    await expect(
      new CheckoutService(prisma, () => {
        throw new Error('test rollback');
      }).checkout(data.user.id, address, `hook-key-${suffix}`),
    ).rejects.toThrow('test rollback');
    expect(await prisma.order.count({ where: { userId: data.user.id } })).toBe(0);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } }))
        .available,
    ).toBe(1);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: data.cart.id } })).status).toBe(
      'ACTIVE',
    );
    expect(await prisma.checkoutOperation.count({ where: { userId: data.user.id } })).toBe(0);
  });
  it('permits exactly one concurrent stock-one checkout', async () => {
    const product = await prisma.product.create({
      data: {
        name: `Concurrent ${suffix}`,
        slug: `concurrent-${suffix}`,
        productType: 'PRINT',
        status: 'ACTIVE',
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `CONCURRENT-${suffix}`,
        name: 'A3',
        attributes: {},
        pricePaise: 1000,
        inventory: { create: { available: 1 } },
      },
    });
    const users = await Promise.all(
      ['a', 'b'].map((value) =>
        prisma.user.create({
          data: { email: `concurrent-${value}-${suffix}@example.test`, role: 'CUSTOMER' },
        }),
      ),
    );
    await Promise.all(
      users.map((user) =>
        prisma.cart.create({
          data: {
            userId: user.id,
            items: { create: { variantId: variant.id, quantity: 1, unitPricePaise: 1000 } },
          },
        }),
      ),
    );
    const results = await Promise.allSettled(
      users.map((user, index) =>
        new CheckoutService(prisma).checkout(user.id, address, `concurrent-key-${index}-${suffix}`),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).available,
    ).toBe(0);
    expect(
      await prisma.order.count({ where: { userId: { in: users.map((user) => user.id) } } }),
    ).toBe(1);
  });
});
