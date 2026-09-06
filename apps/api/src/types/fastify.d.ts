import type { UserRole } from '@boss/database';
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: { id: string; email: string; name: string | null; role: UserRole };
  }
}
