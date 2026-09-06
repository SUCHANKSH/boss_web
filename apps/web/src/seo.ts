import { useEffect } from 'react';
import type { ProductDetail } from './api/catalog.js';

const siteOrigin = import.meta.env.VITE_SITE_ORIGIN ?? window.location.origin;
const updateMeta = (
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  value: string,
) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = value;
};
export function usePageMetadata({
  title,
  description,
  path,
  product,
}: {
  title: string;
  description: string;
  path: string;
  product?: ProductDetail;
}) {
  useEffect(() => {
    document.title = title;
    updateMeta('meta[name="description"]', 'name', 'description', description);
    updateMeta('meta[property="og:title"]', 'property', 'og:title', title);
    updateMeta('meta[property="og:description"]', 'property', 'og:description', description);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = `${siteOrigin}${path}`;
    let structured = document.head.querySelector<HTMLScriptElement>('script[data-boss-product]');
    if (product) {
      if (!structured) {
        structured = document.createElement('script');
        structured.type = 'application/ld+json';
        structured.dataset.bossProduct = 'true';
        document.head.append(structured);
      }
      structured.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description,
        image: product.media.map((media) => media.url),
        offers: product.startingPrice
          ? {
              '@type': 'Offer',
              priceCurrency: product.startingPrice.currency,
              price: product.startingPrice.amountMinor / 100,
            }
          : undefined,
      });
    } else structured?.remove();
  }, [title, description, path, product]);
}
