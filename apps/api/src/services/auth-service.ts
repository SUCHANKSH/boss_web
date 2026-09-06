import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { PrismaClient, User } from '@boss/database';
import { env } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { createOpaqueToken, hashToken } from '../lib/crypto.js';

export type SafeUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;
export class AuthService {
  constructor(private readonly database: PrismaClient) {}
  async register(input: { email: string; password: string; name?: string | undefined }) {
    const email = input.email.trim().toLowerCase();
    if (await this.database.user.findUnique({ where: { email } }))
      throw new AppError(409, 'CONFLICT', 'An account with this email already exists.');
    const passwordHash = await hash(input.password, { algorithm: Algorithm.Argon2id });
    const user = await this.database.user.create({
      data: { email, passwordHash, name: input.name?.trim() || null },
      select: { id: true, email: true, name: true, role: true },
    });
    return { user, token: await this.createSession(user.id) };
  }
  async login(input: { email: string; password: string }) {
    const user = await this.database.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user?.passwordHash || !(await verify(user.passwordHash, input.password)))
      throw new AppError(401, 'AUTHENTICATION_ERROR', 'Invalid email or password.');
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: await this.createSession(user.id),
    };
  }
  async logout(token?: string) {
    if (token) await this.database.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  private async createSession(userId: string) {
    const token = createOpaqueToken();
    await this.database.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + env.AUTH_SESSION_TTL_DAYS * 86_400_000),
      },
    });
    return token;
  }
}
