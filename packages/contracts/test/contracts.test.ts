import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  createVariantSchema,
  paginationQuerySchema,
  publicProductSchema,
  checkoutInputSchema,
  orderSchema,
  orderStatusSchema,
  paymentStatusSchema,
  slugSchema,
} from '../src/index.js';

describe('catalog contracts', () => {
  it('parses valid catalog inputs', () => {
    expect(slugSchema.parse('virat-kohli-poster')).toBe('virat-kohli-poster');
    expect(paginationQuerySchema.parse({}).limit).toBe(20);
    expect(
      createProductSchema.parse({ name: 'Poster', slug: 'poster', productType: 'POSTER' })
        .artworkId,
    ).toBeUndefined();
    expect(
      createVariantSchema.parse({
        sku: 'POSTER_A3',
        name: 'A3',
        attributes: { size: 'A3' },
        pricePaise: 49900,
      }).pricePaise,
    ).toBe(49900);
  });
  it('rejects unsafe input and keeps public products safe', () => {
    expect(() => slugSchema.parse('Not Valid')).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
    expect(() =>
      createVariantSchema.parse({ sku: 'bad sku', name: 'A3', attributes: {}, pricePaise: -1 }),
    ).toThrow();
    expect(publicProductSchema.shape).not.toHaveProperty('artworkId');
    expect(publicProductSchema.shape).not.toHaveProperty('internalNotes');
  });
});

describe('commerce contracts', () => {
  const address = {
    recipientName: 'Customer',
    phone: '9999999999',
    line1: '1 Test Lane',
    city: 'Mumbai',
    state: 'MH',
    postalCode: '400001',
    countryCode: 'IN',
  };
  const order = {
    id: 'corder12345',
    number: 'BOSS-ABC123',
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    currency: 'INR',
    subtotal: { amountMinor: 1000, currency: 'INR' },
    total: { amountMinor: 1000, currency: 'INR' },
    shippingAddress: address,
    items: [
      {
        id: 'citem12345',
        productName: 'Edition',
        variantName: 'A3',
        sku: 'EDITION-A3',
        quantity: 1,
        unitPrice: { amountMinor: 1000, currency: 'INR' },
        lineTotal: { amountMinor: 1000, currency: 'INR' },
      },
    ],
    createdAt: '2026-09-06T00:00:00.000Z',
  };
  it('validates checkout input and rejects malformed commercial input', () => {
    expect(
      checkoutInputSchema.parse({ shippingAddress: address, idempotencyKey: 'a'.repeat(16) })
        .shippingAddress.city,
    ).toBe('Mumbai');
    expect(() =>
      checkoutInputSchema.parse({
        shippingAddress: { ...address, postalCode: '' },
        idempotencyKey: 'a'.repeat(16),
      }),
    ).toThrow();
    expect(() =>
      checkoutInputSchema.parse({ shippingAddress: address, idempotencyKey: 'short' }),
    ).toThrow();
  });
  it('validates immutable order snapshots and rejects invalid money/statuses', () => {
    expect(orderSchema.parse(order).items[0].sku).toBe('EDITION-A3');
    expect(() =>
      orderSchema.parse({ ...order, total: { amountMinor: -1, currency: 'INR' } }),
    ).toThrow();
    expect(() => orderSchema.parse({ ...order, status: 'PAID' })).toThrow();
  });
  it('accepts every implemented order and payment status only', () => {
    expect(orderStatusSchema.options).toHaveLength(11);
    expect(paymentStatusSchema.options).toHaveLength(7);
    orderStatusSchema.options.forEach((value) =>
      expect(orderStatusSchema.parse(value)).toBe(value),
    );
    paymentStatusSchema.options.forEach((value) =>
      expect(paymentStatusSchema.parse(value)).toBe(value),
    );
  });
});
