import type { D1Database } from '@cloudflare/workers-types';
import { listProducts } from '../products/db';
import { listCategories, childrenOf } from '../categories/db';
import { listFeaturedArticles, listPublishedArticles } from '../articles/db';
import { listPublishedBrands, brandNamesForProducts } from '../brands/db';
import { addCacheTags, articleCacheTags, productCacheTags } from '../cache/tags';
import type { ImageDelivery } from '../products/image';
import { buildProductCard } from './productCard';
import { buildArticleCard } from './articleCard';
import type { HomeExperienceModel } from './models';

/**
 * DISCOVER 首页加载器：编辑部头条 + 精选 + 最新资讯 + 新品商品轨 + 频道/品牌入口。
 *
 * 头条优先取编辑精选（featured）中最新一篇，无精选则退化为最新文章——
 * 空库时首页降级为纯商城形态，不报错、不出占位假数据。
 */

const PRODUCT_RAIL_SIZE = 8;
const FEATURED_SIZE = 4;
const LATEST_SIZE = 7;
const BRAND_STRIP_SIZE = 6;
const LATEST_POOL_SIZE = 16;

const LEAD_SIZES = '(min-width: 1024px) 620px, 100vw';
const CARD_SIZES = '(min-width: 1024px) 352px, calc(50vw - 36px)';

export interface HomeOptions {
  /** 响应头，商品/文章缓存标签在此挂载。 */
  responseHeaders: Headers;
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
  currency: string;
}

export async function loadHomeExperience(
  db: D1Database,
  options: HomeOptions,
): Promise<HomeExperienceModel> {
  const [featured, latestPage, products, categories, brands] = await Promise.all([
    listFeaturedArticles(db, FEATURED_SIZE + 1),
    listPublishedArticles(db, { limit: LATEST_POOL_SIZE, offset: 0 }),
    listProducts(db, PRODUCT_RAIL_SIZE),
    listCategories(db),
    listPublishedBrands(db),
  ]);

  // 头条：编辑精选中最新一篇；无精选取最新文章。
  const leadArticle = featured[0] ?? latestPage.articles[0] ?? null;
  // 次级精选：剔除头条后的其余精选。
  const featuredRest = featured.filter((article) => article.id !== leadArticle?.id);
  // 最新资讯：剔除已出现在头条/精选位的文章，避免同页重复。
  const usedIds = new Set<number>([
    ...(leadArticle ? [leadArticle.id] : []),
    ...featuredRest.map((article) => article.id),
  ]);
  const latest = latestPage.articles
    .filter((article) => !usedIds.has(article.id))
    .slice(0, LATEST_SIZE);

  const brandNames = await brandNamesForProducts(
    db,
    products.map((product) => product.id),
  );

  const articleCards = [leadArticle, ...featuredRest, ...latest].filter(
    (article): article is NonNullable<typeof article> => article !== null,
  );
  addCacheTags(options.responseHeaders, [
    ...productCacheTags(products.map((product) => product.public_id)),
    ...articleCacheTags(articleCards.map((article) => article.public_id)),
  ]);

  const imageOptions = {
    baseUrl: options.imageBaseUrl,
    delivery: options.delivery,
  };

  return {
    lead: leadArticle
      ? buildArticleCard(leadArticle, { ...imageOptions, sizes: LEAD_SIZES, priority: true })
      : null,
    featured: featuredRest.map((article) =>
      buildArticleCard(article, { ...imageOptions, sizes: CARD_SIZES }),
    ),
    latest: latest.map((article) =>
      buildArticleCard(article, { ...imageOptions, sizes: CARD_SIZES }),
    ),
    products: products.map((product) =>
      buildProductCard(product, {
        ...imageOptions,
        currency: options.currency,
        sizes: CARD_SIZES,
        brand: brandNames.get(product.id) ?? null,
      }),
    ),
    categories: childrenOf(categories, null).map((category) => ({
      text: category.name,
      href: `/categories/${category.slug}`,
    })),
    brands: brands.slice(0, BRAND_STRIP_SIZE).map((brand) => ({
      name: brand.name,
      href: `/brands/${brand.slug}`,
    })),
  };
}
