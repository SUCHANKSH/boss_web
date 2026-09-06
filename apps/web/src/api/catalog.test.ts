import { describe, expect, it, vi } from 'vitest';
import { catalogApi, CatalogApiError } from './catalog.js';

describe('catalogApi', () => {
  it('parses a public catalog envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
        }),
      }),
    );
    await expect(catalogApi.products()).resolves.toMatchObject({ meta: { page: 1 } });
  });
  it('uses only supported catalog query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { data: [], meta: { page: 2, limit: 12, total: 0, totalPages: 0 } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await catalogApi.products({
      page: 2,
      limit: 12,
      category: 'sports',
      sortBy: 'price',
      sortOrder: 'asc',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/catalog/products?page=2&limit=12&category=sports&sortBy=price&sortOrder=asc',
    );
  });
  it('handles API failures and malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(catalogApi.products()).rejects.toBeInstanceOf(CatalogApiError);
  });
});
