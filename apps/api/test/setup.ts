import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const testDirectory = dirname(fileURLToPath(import.meta.url));

// CI supplies DATABASE_URL directly. Local runs use .env only as a credentials
// source; this setup always changes the database name to the isolated test DB.
config({ path: resolve(testDirectory, '../../../.env') });

const sourceUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('DATABASE_URL is required for API tests.');

const testUrl = new URL(sourceUrl);
testUrl.pathname = '/boss_website_test';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl.toString();
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-thirty-two-characters';
