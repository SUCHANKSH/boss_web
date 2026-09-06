import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-thirty-two-characters';

const { buildApp } = await import('../src/app.js');
const { prisma } = await import('@boss/database');
const app = buildApp();
const email = `phase1-${Date.now()}@example.test`;

beforeAll(async () => app.ready());
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('Phase 1 API', () => {
  it('returns health and live database readiness envelopes', async () => {
    expect((await app.inject('/health')).json()).toMatchObject({
      success: true,
      data: { status: 'ok' },
    });
    expect((await app.inject('/ready')).json()).toMatchObject({
      success: true,
      data: { status: 'ready' },
    });
  });
  it('validates, registers, rejects duplicates, and authenticates sessions', async () => {
    const malformedJson = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(malformedJson.statusCode).toBe(400);
    expect(malformedJson.json().error.code).toBe('VALIDATION_ERROR');
    expect(
      (
        await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'bad' } })
      ).json().error.code,
    ).toBe('VALIDATION_ERROR');
    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, name: 'Test User', password: 'StrongTestPassword123!' },
    });
    expect(registration.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: { email, password: 'StrongTestPassword123!' },
        })
      ).json().error.code,
    ).toBe('CONFLICT');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email, password: 'wrong-password' },
        })
      ).json().error.code,
    ).toBe('AUTHENTICATION_ERROR');
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'StrongTestPassword123!' },
    });
    const cookie = login.headers['set-cookie'];
    expect(login.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).json()).toMatchObject({
      success: true,
      data: { user: { email, role: 'CUSTOMER' } },
    });
    expect((await app.inject('/api/auth/me')).json().error.code).toBe('AUTHENTICATION_ERROR');
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });
});
