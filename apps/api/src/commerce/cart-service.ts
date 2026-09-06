import type { PrismaClient } from '@boss/database';
import { AppError } from '../errors/app-error.js';

const included = {
  items: {
    include: { variant: { include: { product: true, inventory: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};
type CartRecord = Awaited<ReturnType<PrismaClient['cart']['findUniqueOrThrow']>>;

export class CartService {
  constructor(private readonly db: PrismaClient) {}
  private async active(userId: string) {
    const found = await this.db.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: included,
      orderBy: { createdAt: 'desc' },
    });
    return found ?? this.db.cart.create({ data: { userId }, include: included });
  }
  private project(cart: NonNullable<Awaited<ReturnType<CartService['active']>>>) {
    const items = cart.items.map((item) => {
      const tracked = item.variant.inventoryPolicy === 'TRACKED';
      const available = !tracked || (item.variant.inventory?.available ?? 0) >= item.quantity;
      return {
        id: item.id,
        variantId: item.variantId,
        productName: item.variant.product.name,
        variantName: item.variant.name,
        quantity: item.quantity,
        unitPrice: { amountMinor: item.variant.pricePaise, currency: 'INR' as const },
        subtotal: {
          amountMinor: item.variant.pricePaise * item.quantity,
          currency: 'INR' as const,
        },
        available,
      };
    });
    const subtotal = items.reduce((total, item) => total + item.subtotal.amountMinor, 0);
    return {
      id: cart.id,
      currency: 'INR' as const,
      items,
      subtotal: { amountMinor: subtotal, currency: 'INR' as const },
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
    };
  }
  async get(userId: string) {
    return this.project(await this.active(userId));
  }
  async add(userId: string, variantId: string, quantity: number) {
    const variant = await this.db.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true, product: true },
    });
    if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE')
      throw new AppError(404, 'NOT_FOUND', 'The requested edition is unavailable.');
    if (variant.inventoryPolicy === 'TRACKED' && (variant.inventory?.available ?? 0) < quantity)
      throw new AppError(400, 'VALIDATION_ERROR', 'The requested quantity is unavailable.');
    const cart = await this.active(userId);
    const existing = cart.items.find((item) => item.variantId === variantId);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (variant.inventoryPolicy === 'TRACKED' && (variant.inventory?.available ?? 0) < nextQuantity)
      throw new AppError(400, 'VALIDATION_ERROR', 'The requested quantity is unavailable.');
    await this.db.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity, unitPricePaise: variant.pricePaise },
      update: { quantity: nextQuantity, unitPricePaise: variant.pricePaise },
    });
    return this.get(userId);
  }
  async update(userId: string, itemId: string, quantity: number) {
    const cart = await this.active(userId);
    const item = cart.items.find((value) => value.id === itemId);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.');
    if (
      item.variant.inventoryPolicy === 'TRACKED' &&
      (item.variant.inventory?.available ?? 0) < quantity
    )
      throw new AppError(400, 'VALIDATION_ERROR', 'The requested quantity is unavailable.');
    await this.db.cartItem.update({
      where: { id: itemId },
      data: { quantity, unitPricePaise: item.variant.pricePaise },
    });
    return this.get(userId);
  }
  async remove(userId: string, itemId: string) {
    const cart = await this.active(userId);
    if (!cart.items.some((item) => item.id === itemId))
      throw new AppError(404, 'NOT_FOUND', 'Cart item not found.');
    await this.db.cartItem.delete({ where: { id: itemId } });
    return this.get(userId);
  }
  async clear(userId: string) {
    const cart = await this.active(userId);
    await this.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.get(userId);
  }
}
