import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { catalogApi, type ProductDetail } from './api/catalog.js';
import {
  BrowseSkeletons,
  DetailSkeleton,
  Pagination,
  ProductGallery,
  ProductGrid,
  ProductSkeletons,
  State,
  formatMoney,
} from './components.js';
import { usePageMetadata } from './seo.js';

type DataState<T> = { data?: T; error: boolean; retry: () => void };
function useData<T>(key: string, load: () => Promise<T>): DataState<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data?: T; error: boolean }>({ error: false });
  useEffect(() => {
    let active = true;
    setState({ error: false });
    load().then(
      (data) => active && setState({ data, error: false }),
      () => active && setState({ error: true }),
    );
    return () => {
      active = false;
    };
  }, [key, revision]);
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="BOSS home">
          BOSS
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav
          className={open ? 'site-nav is-open' : 'site-nav'}
          id="primary-navigation"
          aria-label="Primary"
        >
          <NavLink end to="/">
            Home
          </NavLink>
          <NavLink to="/products">Shop</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <NavLink to="/collections">Collections</NavLink>
        </nav>
      </header>
      <main id="content">{children}</main>
      <footer className="site-footer">
        <span>Curated prints, objects, and iconography.</span>
        <span>(c) BOSS</span>
      </footer>
    </>
  );
}
function Home() {
  usePageMetadata({
    title: 'BOSS | Collectible visual culture',
    description:
      'Curated prints, objects, and iconography across culture, sport, cinema, music, and more.',
    path: '/',
  });
  const products = useData('home-products', () =>
    catalogApi.products({ limit: 4, sortBy: 'sortOrder', sortOrder: 'asc' }),
  );
  const categories = useData('home-categories', catalogApi.categories);
  const collections = useData('home-collections', catalogApi.collections);
  return (
    <>
      <section className="hero page-bleed">
        <div className="hero__copy">
          <p className="eyebrow">The BOSS archive</p>
          <h1>Icons worth living with.</h1>
          <p>
            Collectible visual culture selected across sport, cinema, music, myth, machines, and
            more.
          </p>
          <Link className="button" to="/products">
            Explore the collection
          </Link>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Selected editions</p>
            <h2>Made to hold attention.</h2>
          </div>
          <Link className="text-link" to="/products">
            View all editions
          </Link>
        </div>
        {!products.data && !products.error ? (
          <ProductSkeletons />
        ) : products.data ? (
          <ProductGrid products={products.data.data} eagerFirst />
        ) : (
          <State
            type="error"
            title="The collection is unavailable."
            action={
              <button type="button" onClick={products.retry}>
                Try again
              </button>
            }
          >
            Please try again shortly.
          </State>
        )}
      </section>
      <section className="editorial-links">
        <Link to="/categories">
          <span className="eyebrow">Browse by theme</span>
          <strong>Categories</strong>
          <span>Explore the full visual spectrum, from sport to mythology.</span>
        </Link>
        <Link to="/collections">
          <span className="eyebrow">Curated edits</span>
          <strong>Collections</strong>
          <span>Discover considered groups of editions and objects.</span>
        </Link>
      </section>
      <section className="discovery-strip">
        <div>
          <p className="eyebrow">Explore the archive</p>
          <h2>Find your point of view.</h2>
        </div>
        <div className="discovery-strip__links">
          {categories.data?.data.slice(0, 4).map((category) => (
            <Link key={category.id} to={`/products?category=${category.slug}`}>
              {category.name}
            </Link>
          ))}
          {collections.data?.data.slice(0, 2).map((collection) => (
            <Link key={collection.id} to={`/products?collection=${collection.slug}`}>
              {collection.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
function Products() {
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get('page') ?? 1);
  const rawLimit = Number(params.get('limit') ?? 12);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 12;
  const query = useMemo(
    () => ({
      page,
      limit,
      category: params.get('category') ?? undefined,
      collection: params.get('collection') ?? undefined,
      sortBy: params.get('sortBy') ?? 'sortOrder',
      sortOrder: params.get('sortOrder') ?? 'asc',
    }),
    [params, page, limit],
  );
  usePageMetadata({
    title: 'Shop collectible editions | BOSS',
    description: 'Browse curated BOSS editions by category, collection, and sort order.',
    path: `/products${params.size ? `?${params}` : ''}`,
  });
  const products = useData(params.toString(), () => catalogApi.products(query));
  const filters = useData('catalog-filter-options', async () => {
    const [categories, collections] = await Promise.all([
      catalogApi.categories(),
      catalogApi.collections(),
    ]);
    return { categories: categories.data, collections: collections.data };
  });
  const update = (next: Record<string, string | undefined>) =>
    setParams((current) => {
      Object.entries(next).forEach(([key, value]) =>
        value === undefined ? current.delete(key) : current.set(key, value),
      );
      return current;
    });
  return (
    <section>
      <div className="section-heading section-heading--catalog">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Find your next icon.</h1>
        </div>
        <div className="catalog-controls" aria-label="Catalog controls">
          <label>
            Category
            <select
              value={query.category ?? ''}
              onChange={(event) => update({ category: event.target.value || undefined, page: '1' })}
            >
              <option value="">All categories</option>
              {filters.data?.categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Collection
            <select
              value={query.collection ?? ''}
              onChange={(event) =>
                update({ collection: event.target.value || undefined, page: '1' })
              }
            >
              <option value="">All collections</option>
              {filters.data?.collections.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              value={String(query.sortBy)}
              onChange={(event) => update({ sortBy: event.target.value, page: '1' })}
            >
              <option value="sortOrder">Curated</option>
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="createdAt">Newest</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={String(query.sortOrder)}
              onChange={(event) => update({ sortOrder: event.target.value, page: '1' })}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </div>
      {!products.data && !products.error ? (
        <ProductSkeletons count={8} />
      ) : products.data?.data.length ? (
        <>
          <ProductGrid products={products.data.data} />
          <Pagination
            page={products.data.meta.page}
            totalPages={products.data.meta.totalPages}
            onPage={(nextPage) => update({ page: String(nextPage) })}
          />
        </>
      ) : products.data ? (
        <State
          type="empty"
          title="No editions match this view."
          action={
            <Link className="button" to="/products">
              Reset catalog
            </Link>
          }
        >
          Try a different category, collection, or sort order.
        </State>
      ) : (
        <State
          type="error"
          title="Unable to load products."
          action={
            <button type="button" onClick={products.retry}>
              Try again
            </button>
          }
        >
          Your catalog filters are still available.
        </State>
      )}
    </section>
  );
}
function Browse({ kind }: { kind: 'categories' | 'collections' }) {
  const singular = kind === 'categories' ? 'category' : 'collection';
  const title = kind === 'categories' ? 'Categories' : 'Collections';
  usePageMetadata({
    title: `${title} | BOSS`,
    description: `Explore BOSS ${kind} and the editions within them.`,
    path: `/${kind}`,
  });
  const data = useData(kind, () =>
    kind === 'categories' ? catalogApi.categories() : catalogApi.collections(),
  );
  return (
    <section className="browse-page">
      <div className="browse-page__intro">
        <p className="eyebrow">Browse the archive</p>
        <h1>{title}</h1>
        <p>Follow a visual thread into a focused selection of BOSS editions.</p>
      </div>
      {!data.data && !data.error ? (
        <BrowseSkeletons />
      ) : data.data?.data.length ? (
        <div className="browse-grid">
          {data.data.data.map((item) => (
            <Link className="browse-card" key={item.id} to={`/products?${singular}=${item.slug}`}>
              <span className="eyebrow">{singular}</span>
              <strong>{item.name}</strong>
              <span>{item.description ?? 'Explore this edit of collectible visual culture.'}</span>
              <span className="text-link">Explore editions</span>
            </Link>
          ))}
        </div>
      ) : data.data ? (
        <State
          type="empty"
          title={`No ${kind} are available yet.`}
          action={
            <Link className="button" to="/products">
              Browse all editions
            </Link>
          }
        >
          Please check back soon.
        </State>
      ) : (
        <State
          type="error"
          title={`Unable to load ${kind}.`}
          action={
            <button type="button" onClick={data.retry}>
              Try again
            </button>
          }
        >
          Please try again shortly.
        </State>
      )}
    </section>
  );
}
function Detail() {
  const { id = '' } = useParams();
  const product = useData<ProductDetail>(id, () => catalogApi.product(id));
  usePageMetadata(
    product.data
      ? {
          title: `${product.data.name} | BOSS`,
          description:
            product.data.description ?? product.data.shortDescription ?? 'A curated BOSS edition.',
          path: `/products/${id}`,
          product: product.data,
        }
      : {
          title: 'Edition | BOSS',
          description: 'A curated BOSS edition.',
          path: `/products/${id}`,
        },
  );
  if (product.error)
    return (
      <State
        type="not-found"
        title="This edition is no longer in the archive."
        action={
          <Link className="button" to="/products">
            Return to catalog
          </Link>
        }
      >
        It may have moved, or the link may be incomplete.
      </State>
    );
  if (!product.data)
    return (
      <section>
        <DetailSkeleton />
      </section>
    );
  const item = product.data;
  return (
    <section className="detail">
      <ProductGallery product={item} />
      <div className="detail__copy">
        <p className="eyebrow">
          {item.categories.map((category) => category.name).join(' / ') || item.productType}
        </p>
        <h1>{item.name}</h1>
        <p className="detail__description">
          {item.description ?? item.shortDescription ?? 'A curated BOSS edition.'}
        </p>
        <p className="detail__price">
          {item.startingPrice
            ? `From ${formatMoney(item.startingPrice.amountMinor)}`
            : 'Edition details coming soon'}
        </p>
        {item.collections.length > 0 && (
          <p className="detail__context">
            Part of {item.collections.map((collection) => collection.name).join(' / ')}
          </p>
        )}
        <div className="variants">
          <p className="eyebrow">Available formats</p>
          {item.variants.length ? (
            item.variants.map((variant) => (
              <span className="variant" key={variant.id}>
                {variant.name} <b>{formatMoney(variant.price.amountMinor)}</b>
              </span>
            ))
          ) : (
            <span className="quiet">Format information is coming soon.</span>
          )}
        </div>
        <p className="quiet">Purchase options arrive in a future release.</p>
      </div>
    </section>
  );
}
function NotFound() {
  usePageMetadata({
    title: 'Page not found | BOSS',
    description: 'The requested BOSS page could not be found.',
    path: '/not-found',
  });
  return (
    <State
      type="not-found"
      title="This page is not in the archive."
      action={
        <Link className="button" to="/">
          Return home
        </Link>
      }
    >
      Explore the collection or begin again from the BOSS archive.
    </State>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<Detail />} />
          <Route path="/categories" element={<Browse kind="categories" />} />
          <Route path="/collections" element={<Browse kind="collections" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
