import { cartItemInputSchema, updateCartItemSchema } from '@boss/contracts';
import type { PrismaClient } from '@boss/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../plugins/auth.js';
import { CartService } from './cart-service.js';

const itemParams = z.object({ id: z.string().regex(/^c[a-z0-9]{8,}$/i) });
const customer = async (request: Parameters<typeof authenticate>[0], database: PrismaClient) => {
  await authenticate(request, database);
  await requireRole('CUSTOMER')(request);
};
export function registerCommerceRoutes(app: FastifyInstance, database: PrismaClient) {
  const cart = new CartService(database);
  const guard = (request: Parameters<typeof authenticate>[0]) => customer(request, database);
  app.get('/api/cart', { preHandler: guard }, async (request) => ({
    success: true,
    data: await cart.get(request.authUser!.id),
  }));
  app.post('/api/cart/items', { preHandler: guard }, async (request) => {
    const input = cartItemInputSchema.parse(request.body);
    return {
      success: true,
      data: await cart.add(request.authUser!.id, input.variantId, input.quantity),
    };
  });
  app.patch('/api/cart/items/:id', { preHandler: guard }, async (request) => {
    const input = updateCartItemSchema.parse(request.body);
    return {
      success: true,
      data: await cart.update(
        request.authUser!.id,
        itemParams.parse(request.params).id,
        input.quantity,
      ),
    };
  });
  app.delete('/api/cart/items/:id', { preHandler: guard }, async (request) => ({
    success: true,
    data: await cart.remove(request.authUser!.id, itemParams.parse(request.params).id),
  }));
  app.delete('/api/cart', { preHandler: guard }, async (request) => ({
    success: true,
    data: await cart.clear(request.authUser!.id),
  }));
}
