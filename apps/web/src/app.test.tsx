import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

const product = {
  id: 'cproduct123',
  name: 'Test Edition',
  slug: 'test-edition',
  description: 'A public description.',
  shortDescription: null,
  productType: 'PRINT',
  isCustomizable: false,
  thumbnail: null,
  startingPrice: { amountMinor: 120000, currency: 'INR' },
  available: true,
  categories: [],
  collections: [],
};
const page = {
  success: true,
  data: { data: [product], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
};
const filters = {
  success: true,
  data: {
    data: [
      {
        id: 'ccategory123',
        name: 'Sport',
        slug: 'sport',
        description: null,
        parentId: null,
        sortOrder: 0,
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
};
const collectionFilters = {
  success: true,
  data: {
    data: [
      {
        id: 'ccollection123',
        name: 'Classics',
        slug: 'classics',
        description: null,
        sortOrder: 0,
        startsAt: null,
        endsAt: null,
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
};
const detail = {
  success: true,
  data: {
    ...product,
    media: [],
    variants: [
      {
        id: 'cvariant123',
        name: 'A3',
        attributes: { size: 'A3' },
        price: { amountMinor: 120000, currency: 'INR' },
        compareAtPrice: null,
        isActive: true,
      },
    ],
  },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('storefront routes', () => {
  afterEach(() => cleanup());
  beforeEach(() => window.history.pushState({}, '', '/products'));
  it('renders catalog products and changes supported filter and sort queries', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/categories')) return Promise.resolve(json(filters));
      if (path.includes('/collections')) return Promise.resolve(json(collectionFilters));
      return Promise.resolve(json(page));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(await screen.findByText('Test Edition')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('sortBy=name'))).toBe(true),
    );
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'sport' } });
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('category=sport'))).toBe(
        true,
      ),
    );
    fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'classics' } });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('collection=classics')),
      ).toBe(true),
    );
  });
  it('renders public product detail variants', async () => {
    window.history.pushState({}, '', '/products/cproduct123');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith('/products/cproduct123')) return Promise.resolve(json(detail));
        return Promise.resolve(json({ success: true, data: [] }));
      }),
    );
    render(<App />);
    expect(await screen.findByText('A3', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/sku|inventory/i)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('Test Edition | BOSS');
  });
  it('renders a not-found state for a missing product', async () => {
    window.history.pushState({}, '', '/products/cmissing12345');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ success: false }, 404))),
    );
    render(<App />);
    expect(await screen.findByText(/no longer in the archive/i)).toBeTruthy();
  });
  it('exposes semantic primary navigation and toggles the mobile navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(page))),
    );
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('aria-current')).toBe('page');
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
  });
  it('moves catalog pagination into URL state', async () => {
    const paginated = {
      success: true,
      data: { data: [product], meta: { page: 1, limit: 12, total: 24, totalPages: 2 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(paginated))),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(window.location.search).toContain('page=2'));
  });
  it('renders a recovery action for an empty catalog response', async () => {
    const empty = {
      success: true,
      data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(empty))),
    );
    render(<App />);
    expect(await screen.findByText(/no editions match/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /reset catalog/i })).toBeTruthy();
  });
});
