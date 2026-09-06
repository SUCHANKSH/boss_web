import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProductCard, State } from './components.js';

const product = {
  id: 'cproduct123',
  name: 'Test Edition',
  slug: 'test-edition',
  description: null,
  shortDescription: null,
  productType: 'PRINT',
  isCustomizable: false,
  thumbnail: null,
  startingPrice: { amountMinor: 120000, currency: 'INR' as const },
  available: true,
  categories: [],
  collections: [],
};
describe('storefront primitives', () => {
  it('renders only public product fields with an accessible fallback', () => {
    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Test Edition')).toBeTruthy();
    expect(screen.getByRole('link', { name: /view test edition/i })).toBeTruthy();
    expect(screen.getByText('BOSS edition')).toBeTruthy();
    expect(screen.queryByText(/sku|inventory|internal/i)).toBeNull();
  });
  it('renders loading, empty, and error states semantically', () => {
    const { rerender } = render(
      <State type="loading" title="Loading products">
        Loading products...
      </State>,
    );
    expect(screen.getByText('Loading products...')).toBeTruthy();
    rerender(
      <State type="empty" title="No products found">
        No products found.
      </State>,
    );
    expect(screen.getByText('No products found.')).toBeTruthy();
    rerender(
      <State type="error" title="Unable to load products">
        Unable to load products.
      </State>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
