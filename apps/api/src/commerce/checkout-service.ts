import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@boss/database';
import { AppError } from '../errors/app-error.js';

type Address = {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};
const includeOrder = { items: true, payments: { select: { status: true }, take: 1 } } as const;
const fingerprint = (address: Address) =>
  createHash('sha256').update(JSON.stringify(address)).digest('hex');
const orderNumber = () => `BOSS-${randomBytes(6).toString('hex').toUpperCase()}`;

export class CheckoutService {
  constructor(
    private readonly db: PrismaClient,
    private readonly testAfterInventory?: () => void,
  ) {}
  private project(order: Prisma.OrderGetPayload<{ include: typeof includeOrder }>) {
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.payments[0]?.status ?? 'PENDING',
      currency: 'INR' as const,
      subtotal: { amountMinor: order.subtotalPaise, currency: 'INR' as const },
      total: { amountMinor: order.totalPaise, currency: 'INR' as const },
      shippingAddress: order.shippingAddress as Address,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: { amountMinor: item.unitPricePaise, currency: 'INR' as const },
        lineTotal: { amountMinor: item.unitPricePaise * item.quantity, currency: 'INR' as const },
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }
  async get(userId: string, id: string) {
    const order = await this.db.order.findFirst({ where: { id, userId }, include: includeOrder });
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    return this.project(order);
  }
  async list(userId: string) {
    const orders = await this.db.order.findMany({
      where: { userId },
      include: includeOrder,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.project(order));
  }
  async checkout(userId: string, address: Address, idempotencyKey: string) {
    const requestFingerprint = fingerprint(address);
    const result = await this.db.$transaction(
      async (tx) => {
        const existing = await tx.checkoutOperation.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: { order: { include: includeOrder } },
        });
        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint)
            throw new AppError(
              409,
              'CONFLICT',
              'This idempotency key was already used with different checkout information.',
            );
          return existing.order;
        }
        const cart = await tx.cart.findFirst({
          where: { userId, status: 'ACTIVE' },
          include: {
            items: { include: { variant: { include: { product: true, inventory: true } } } },
          },
        });
        if (!cart || !cart.items.length)
          throw new AppError(400, 'VALIDATION_ERROR', 'Your cart is empty.');
        let subtotal = 0;
        for (const item of cart.items) {
          const variant = item.variant;
          if (!variant.isActive || variant.product.status !== 'ACTIVE')
            throw new AppError(400, 'VALIDATION_ERROR', 'A cart item is no longer available.');
          if (variant.currency !== 'INR' || item.unitPricePaise !== variant.pricePaise)
            throw new AppError(
              409,
              'CONFLICT',
              'Cart pricing has changed. Please review your cart.',
            );
          if (variant.inventoryPolicy === 'TRACKED') {
            const changed = await tx.inventory.updateMany({
              where: { variantId: variant.id, available: { gte: item.quantity } },
              data: { available: { decrement: item.quantity } },
            });
            if (changed.count !== 1)
              throw new AppError(
                409,
                'CONFLICT',
                'A cart item no longer has sufficient inventory.',
              );
          }
          subtotal += variant.pricePaise * item.quantity;
        }
        this.testAfterInventory?.();
        const order = await tx.order.create({
          data: {
            userId,
            number: orderNumber(),
            subtotalPaise: subtotal,
            totalPaise: subtotal,
            shippingAddress: address,
            items: {
              create: cart.items.map((item) => ({
                variantId: item.variantId,
                productName: item.variant.product.name,
                variantName: item.variant.name,
                sku: item.variant.sku,
                unitPricePaise: item.variant.pricePaise,
                quantity: item.quantity,
              })),
            },
            payments: { create: { provider: 'PENDING_PROVIDER', amountPaise: subtotal } },
          },
          include: includeOrder,
        });
        await tx.cart.update({ where: { id: cart.id }, data: { status: 'CONVERTED' } });
        for (const item of cart.items) {
          if (item.variant.inventoryPolicy === 'TRACKED') {
            const inventory = await tx.inventory.findUniqueOrThrow({
              where: { variantId: item.variantId },
            });
            await tx.inventoryAdjustment.create({
              data: {
                inventoryId: inventory.id,
                delta: -item.quantity,
                reason: 'ORDER_CHECKOUT',
                referenceId: order.id,
                note: null,
              },
            });
          }
        }
        await tx.checkoutOperation.create({
          data: { userId, idempotencyKey, requestFingerprint, orderId: order.id },
        });
        return order;
      },
      { isolationLevel: 'Serializable' },
    );
    return this.project(result);
  }
}
