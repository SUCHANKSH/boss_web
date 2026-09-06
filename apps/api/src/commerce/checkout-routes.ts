import { checkoutInputSchema } from '@boss/contracts';
import type { PrismaClient } from '@boss/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../plugins/auth.js';
import { CheckoutService } from './checkout-service.js';

const params = z.object({ id: z.string().regex(/^c[a-z0-9]{8,}$/i) });
export function registerCheckoutRoutes(app: FastifyInstance, database: PrismaClient) {
  const service = new CheckoutService(database);
  const guard = async (request: Parameters<typeof authenticate>[0]) => {
    await authenticate(request, database);
    await requireRole('CUSTOMER')(request);
  };
  app.post('/api/checkout', { preHandler: guard }, async (request) => {
    const body = checkoutInputSchema.parse(request.body);
    return {
      success: true,
      data: await service.checkout(request.authUser!.id, body.shippingAddress, body.idempotencyKey),
    };
  });
  app.get('/api/orders', { preHandler: guard }, async (request) => ({
    success: true,
    data: await service.list(request.authUser!.id),
  }));
  app.get('/api/orders/:id', { preHandler: guard }, async (request) => ({
    success: true,
    data: await service.get(request.authUser!.id, params.parse(request.params).id),
  }));
}
