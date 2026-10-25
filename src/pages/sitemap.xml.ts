import type { APIRoute } from 'astro';
import { PUBLIC_CACHE_CONTROL } from '../features/cache/public';
import { env } from 'cloudflare:workers';
import { listProducts, countProducts } from '../features/products/db';
import { listCategories } from '../features/categories/db';
import { listPublishedPages } from '../features/pages/db';
import { listPublishedArticles } from '../features/articles/db';
import { listPublishedBrands } from '../features/brands/db';
import { publicOrigin } from '../features/http/origin';

export const prerender = false;

/**
 * Every URL the sitemap should list, in order.
 *
 * HYPEBEN: `/` is the DISCOVER editorial home and is listed as such — unless a
 * merchant pointed the home page at a page or product, in which case `/`
 * renders that target and canonicals to its own URL (already listed), so only
 * the target's URL belongs here. The catalog always lives at `/products`.
 *
 * Pure and exported so the rule is testable without standing up a request.
 */
export function sitemapLocs(
  origin: string,
  homePage: string | null | undefined,
  data: {
    categories: { slug: string }[];
    products: { slug: string }[];
    pages: { slug: string }[];
    articles: { slug: string }[];
    brands: { slug: string }[];
  },
): string[] {
  return [
    // `/` only when it renders the editorial home itself; an overridden `/`
    // canonicals to its target, which is listed on its own URL below.
    ...(homePage ? [] : [`${origin}/`]),
    `${origin}/products`,
    `${origin}/articles`,
    `${origin}/brands`,
    ...data.categories.map((c) => `${origin}/categories/${c.slug}`),
    ...data.products.map((p) => `${origin}/products/${p.slug}`),
    // Published pages only — drafts must not be discoverable.
    ...data.pages.map((p) => `${origin}/pages/${p.slug}`),
    ...data.articles.map((a) => `${origin}/articles/${a.slug}`),
    ...data.brands.map((b) => `${origin}/brands/${b.slug}`),
  ];
}

// Dynamic sitemap: editorial home + catalog + every active product, category,
// published page/article/brand. Slugs are URL-safe (a-z0-9-), so no XML
// escaping is needed.
export const GET: APIRoute = async ({ url, locals }) => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  const total = await countProducts(env.DB);
  const products = total > 0 ? await listProducts(env.DB, total, 0) : [];
  const categories = await listCategories(env.DB);
  const pages = await listPublishedPages(env.DB);
  // Every published article/brand: the 资讯中心 is a first-class part of the
  // site, so its URLs are discoverable exactly like products are.
  const [articlesPage, brands] = await Promise.all([
    listPublishedArticles(env.DB, { limit: 10_000, offset: 0 }),
    listPublishedBrands(env.DB),
  ]);

  const locs = sitemapLocs(origin, locals.settings?.homePage, {
    categories,
    products,
    pages,
    articles: articlesPage.articles,
    brands,
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((l) => `  <url><loc>${l}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': PUBLIC_CACHE_CONTROL,
    },
  });
};
