import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma, type PrismaClient } from '@boss/database';
import Fastify from 'fastify';
import { ZodError, z } from 'zod';

import { env } from './config.js';
import { AppError } from './errors/app-error.js';
import { authenticate } from './plugins/auth.js';
import { AuthService } from './services/auth-service.js';
import { registerAdminRoutes } from './admin/routes.js';
import { registerPublicCatalogRoutes } from './catalog/public-routes.js';
import { registerCommerceRoutes } from './commerce/routes.js';
import { registerCheckoutRoutes } from './commerce/checkout-routes.js';

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export function buildApp(database: PrismaClient = prisma) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });
  app.register(helmet);
  app.register(cookie);
  app.register(cors, { credentials: true, origin: env.WEB_ORIGIN });
  app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  app.addHook('onRequest', async (request, reply) => {
    const supplied = request.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(supplied)
        ? supplied
        : `req_${request.id}`;
    reply.header('x-request-id', requestId);
    request.log = request.log.child({ requestId });
  });
  app.setErrorHandler((error, request, reply) => {
    const externalStatusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;
    const appError =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data.')
          : externalStatusCode !== undefined &&
              externalStatusCode >= 400 &&
              externalStatusCode < 500
            ? new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data.')
            : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    if (appError.statusCode >= 500) request.log.error({ err: error }, 'request failed');
    reply.status(appError.statusCode).send({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        requestId: reply.getHeader('x-request-id'),
      },
    });
  });
  const success = <T>(data: T) => ({ success: true, data });
  const setSessionCookie = (reply: import('fastify').FastifyReply, token: string) =>
    reply.setCookie(env.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: env.AUTH_SESSION_TTL_DAYS * 86_400,
    });

  app.get('/health', async () => success({ status: 'ok', service: 'api' }));
  app.get('/ready', async () => {
    await database.$queryRaw`SELECT 1`;
    return success({ status: 'ready' });
  });
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = await new AuthService(database).register(registerSchema.parse(request.body));
      setSessionCookie(reply, result.token);
      return reply.status(201).send(success({ user: result.user }));
    },
  );
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = await new AuthService(database).login(loginSchema.parse(request.body));
      setSessionCookie(reply, result.token);
      return success({ user: result.user });
    },
  );
  app.post('/api/auth/logout', async (request, reply) => {
    await new AuthService(database).logout(request.cookies[env.AUTH_COOKIE_NAME]);
    reply.clearCookie(env.AUTH_COOKIE_NAME, { path: '/' });
    return success({});
  });
  app.get(
    '/api/auth/me',
    { preHandler: (request) => authenticate(request, database) },
    async (request) => success({ user: request.authUser }),
  );
  registerAdminRoutes(app, database);
  registerPublicCatalogRoutes(app, database);
  registerCommerceRoutes(app, database);
  registerCheckoutRoutes(app, database);

  return app;
}
