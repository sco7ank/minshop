import type { D1Database } from '@cloudflare/workers-types';
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
  publishedCountsByCategory,
  relatedArticles,
  productsForArticle,
  brandsForArticle,
} from '../articles/db';
import { ARTICLE_CATEGORIES, articleCategoryLabel } from '../articles/taxonomy';
import { listPublishedBrands } from '../brands/db';
import { getProductsByIds, type Product } from '../products/db';
import { renderMarkdown } from '../pages/markdown';
import { buildArticleCard, formatArticleDate } from './articleCard';
import { buildProductCard, buildStorefrontImage } from './productCard';
import { MAX_PUBLIC_PAGE, paginate, queryHref } from '../../pagination';
import type {
  ArticleDetailModel,
  ArticlesListModel,
  StorefrontPaginationModel,
} from './models';
import type { ImageDelivery } from '../products/image';

/**
 * HYPEBEN 资讯中心加载器：列表（频道筛选 + 分页）与详情（关联商品/品牌/推荐文章）。
 * 模板只消费模型；所有 URL、日期、频道标签在此解析。
 */

const PAGE_SIZE = 12;

/** 文章列表分页：保留 category 参数（默认页/默认排序省略，保持 URL 干净）。 */
function articlePaginationModel(
  base: string,
  page: number,
  totalPages: number,
  category: string | null,
): StorefrontPaginationModel {
  const hrefFor = (target: number) =>
    queryHref(base, { category: category ?? undefined, page: target > 1 ? target : undefined });
  const items: StorefrontPaginationModel['items'] =
    totalPages > 1
      ? windowed(page, totalPages).map((target) => ({
          page: target,
          href: target === null ? null : hrefFor(target),
          current: target === page,
        }))
      : [];
  return {
    page,
    totalPages,
    prevHref: page > 1 ? hrefFor(page - 1) : null,
    nextHref: page < totalPages ? hrefFor(page + 1) : null,
    items,
  };
}

function windowed(current: number, total: number): (number | null)[] {
  const keep = new Set<number>([1, total, current, current - 1, current + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous > 1) out.push(null);
    out.push(page);
    previous = page;
  }
  return out;
}

export interface ArticlesListOptions {
  base: string;
  searchParams: URLSearchParams;
  responseHeaders: Headers;
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
  currency: string;
}

export async function loadArticlesList(
  db: D1Database,
  options: ArticlesListOptions,
): Promise<ArticlesListModel> {
  const rawCategory = options.searchParams.get('category');
  const category =
    rawCategory && ARTICLE_CATEGORIES.some((c) => c.slug === rawCategory) ? rawCategory : null;

  const [page, counts] = await Promise.all([
    listPublishedArticles(db, {
      category,
      limit: PAGE_SIZE,
      offset: 0, // 先取一页算分页，再按 offset 重取（见下）
    }),
    publishedCountsByCategory(db),
  ]);

  const { page: pageNumber, offset, totalPages } = paginate(
    options.searchParams,
    page.total,
    PAGE_SIZE,
    MAX_PUBLIC_PAGE,
  );

  // offset 可能被 paginate 校正（越界 page），重取对应页。
  const finalPage =
    offset === 0
      ? page
      : await listPublishedArticles(db, { category, limit: PAGE_SIZE, offset });

  const cards = finalPage.articles.map((article) =>
    buildArticleCard(article, {
      baseUrl: options.imageBaseUrl,
      delivery: options.delivery,
      sizes: '(min-width: 1024px) 352px, calc(50vw - 36px)',
    }),
  );

  // 无频道筛选时，第一篇文章作头条大图。
  const lead = category === null && cards.length > 0 ? cards[0] : null;
  const grid = lead ? cards.slice(1) : cards;

  const categories = ARTICLE_CATEGORIES.map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    blurb: entry.blurb,
    count: counts.get(entry.slug) ?? 0,
    href: queryHref(options.base, { category: entry.slug }),
    current: entry.slug === category,
  }));

  return {
    categories,
    currentCategory: category,
    currentCategoryLabel: category ? articleCategoryLabel(category) : null,
    lead,
    articles: grid,
    total: finalPage.total,
    pagination: articlePaginationModel(options.base, pageNumber, totalPages, category),
  };
}
export interface ArticleDetailOptions {
  slug: string | undefined;
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
  currency: string;
}

export type LoadedArticle =
  | { status: 'not_found' }
  | {
      status: 'ok';
      model: ArticleDetailModel;
      /** 响应缓存标签（关联商品）。 */
      cacheTagIds: (string | null)[];
    };

export async function loadArticleDetail(
  db: D1Database,
  options: ArticleDetailOptions,
): Promise<LoadedArticle> {
  const article = options.slug ? await getPublishedArticleBySlug(db, options.slug) : null;
  if (!article) return { status: 'not_found' };

  const [related, brandIds, productIds] = await Promise.all([
    relatedArticles(db, article, 3),
    brandsForArticle(db, article.id),
    productsForArticle(db, article.id),
  ]);

  const products: Product[] =
    productIds.length > 0 ? await getProductsByIds(db, productIds) : [];
  // 只展示在售商品；下架商品静默剔除（购买入口不得指向不可购买状态）。
  const activeProducts = products.filter((product) => product.active === 1);
  const brands = (await listPublishedBrands(db)).filter((brand) => brandIds.includes(brand.id));

  const cards = activeProducts.map((product) =>
    buildProductCard(product, {
      baseUrl: options.imageBaseUrl,
      delivery: options.delivery,
      currency: options.currency,
      sizes: '(min-width: 1024px) 252px, calc(50vw - 36px)',
    }),
  );

  return {
    status: 'ok',
    cacheTagIds: activeProducts.map((product) => product.public_id),
    model: {
      id: article.public_id ?? '',
      title: article.title,
      excerpt: article.excerpt,
      author: article.author,
      category: articleCategoryLabel(article.category),
      categorySlug: article.category,
      date: formatArticleDate(article.published_at),
      image: article.cover_image_key
        ? buildStorefrontImage(article.cover_image_key, article.title, {
            baseUrl: options.imageBaseUrl,
            delivery: options.delivery,
            sizes: '(min-width: 768px) 900px, 100vw',
            priority: true,
          })
        : null,
      html: renderMarkdown(article.body_markdown, { baseUrl: options.imageBaseUrl }),
      brands: brands.map((brand) => ({
        text: brand.name,
        href: `/brands/${brand.slug}`,
      })),
      products: cards,
      related: related.map((entry) =>
        buildArticleCard(entry, {
          baseUrl: options.imageBaseUrl,
          delivery: options.delivery,
          sizes: '(min-width: 1024px) 352px, calc(50vw - 36px)',
        }),
      ),
      backHref: '/articles',
    },
  };
}
