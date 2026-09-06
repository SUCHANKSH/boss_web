import type { PrismaClient, UserRole } from '@boss/database';
import type { FastifyRequest } from 'fastify';
import { env } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { hashToken } from '../lib/crypto.js';

export async function authenticate(request: FastifyRequest, database: PrismaClient): Promise<void> {
  const token = request.cookies[env.AUTH_COOKIE_NAME];
  if (!token) throw new AppError(401, 'AUTHENTICATION_ERROR', 'Authentication is required.');
  const session = await database.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await database.session.delete({ where: { id: session.id } });
    throw new AppError(401, 'AUTHENTICATION_ERROR', 'Session is invalid or expired.');
  }
  request.authUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.authUser)
      throw new AppError(401, 'AUTHENTICATION_ERROR', 'Authentication is required.');
    if (!roles.includes(request.authUser.role))
      throw new AppError(
        403,
        'AUTHORIZATION_ERROR',
        'You are not authorized to perform this action.',
      );
  };
}
