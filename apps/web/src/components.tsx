import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product, ProductDetail } from './api/catalog.js';

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount / 100);

export function State({
  type,
  title,
  children,
  action,
}: {
  type: 'loading' | 'empty' | 'error' | 'not-found';
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={`state state--${type}`} role={type === 'error' ? 'alert' : undefined}>
      <p className="eyebrow">{type === 'not-found' ? 'Not found' : type}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {action && <div className="state__action">{action}</div>}
    </section>
  );
}

function ImageSurface({
  src,
  alt,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="art__fallback">BOSS edition</span>;
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  return (
    <Link
      className="product-card"
      to={`/products/${product.id}`}
      aria-label={`View ${product.name}`}
    >
      <div className="art product-card__art">
        <ImageSurface
          src={product.thumbnail?.url}
          alt={product.thumbnail?.altText ?? product.name}
          eager={eager}
        />
      </div>
      <div className="product-card__meta">
        <span className="eyebrow">{product.categories[0]?.name ?? product.productType}</span>
        <h3>{product.name}</h3>
        <p>
          {product.startingPrice
            ? `From ${formatMoney(product.startingPrice.amountMinor)}`
            : 'Edition details coming soon'}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  eagerFirst = false,
}: {
  products: Product[];
  eagerFirst?: boolean;
}) {
  return (
    <div className="grid" aria-label="Products">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} eager={eagerFirst && index === 0} />
      ))}
    </div>
  );
}

export function ProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid" aria-label="Loading products" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card skeleton" key={index} aria-hidden="true">
          <div className="art" />
          <span />
          <h3 />
          <p />
        </div>
      ))}
    </div>
  );
}
export function BrowseSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="browse-grid" aria-label="Loading browse options" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="browse-card skeleton" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}

export function ProductGallery({ product }: { product: ProductDetail }) {
  const [selected, setSelected] = useState(0);
  const media = product.media;
  const selectedMedia = media[selected];
  if (!media.length)
    return <div className="art gallery__empty">Product imagery is coming soon.</div>;
  return (
    <div className="gallery" aria-label={`${product.name} media gallery`}>
      <div className="gallery__main art">
        <ImageSurface src={selectedMedia.url} alt={selectedMedia.altText ?? product.name} eager />
      </div>
      {media.length > 1 && (
        <div className="gallery__thumbs" aria-label="Choose product image">
          {media.map((item, index) => (
            <button
              className={index === selected ? 'is-selected' : ''}
              key={item.id}
              type="button"
              aria-label={`Show image ${index + 1} of ${media.length}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
            >
              <ImageSurface src={item.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function DetailSkeleton() {
  return (
    <div className="detail" aria-label="Loading product" aria-busy="true">
      <div className="art skeleton" />
      <div className="detail__copy skeleton">
        <span />
        <h1 />
        <p />
        <p />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages < 2) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 1} type="button" onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button disabled={page === totalPages} type="button" onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
