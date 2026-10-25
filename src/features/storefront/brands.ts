import type { D1Database } from '@cloudflare/workers-types';
import {
  getArticlesByIds,
  type Article,
} from '../articles/db';
import {
  brandContentCounts,
  articlesForBrand,
  getPublishedBrandBySlug,
  listPublishedBrands,
  productsForBrand,
} from '../brands/db';
import { getProductsByIds } from '../products/db';
import { addCacheTags, articleCacheTags, brandCacheTags, productCacheTags } from '../cache/tags';
import type { ImageDelivery } from '../products/image';
import { buildProductCard, buildStorefrontImage } from './productCard';
import { buildArticleCard } from './articleCard';
import type {
  BrandPageModel,
  BrandsIndexModel,
} from './models';

/**
 * 品牌加载器：索引页（全部已发布品牌 + 内容计数）与品牌页
 * （介绍 + 相关报道 + 在售商品，三合一）。
 */

const BRAND_PAGE_PRODUCTS = 24;
const BRAND_PAGE_ARTICLES = 6;
const CARD_SIZES = '(min-width: 1024px) 352px, calc(50vw - 36px)';

export interface BrandsIndexOptions {
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
}

export async function loadBrandsIndex(
  db: D1Database,
  options: BrandsIndexOptions,
): Promise<BrandsIndexModel> {
  const [brands, counts] = await Promise.all([listPublishedBrands(db), brandContentCounts(db)]);
  return {
    brands: brands.map((brand) => ({
      id: brand.public_id ?? '',
      name: brand.name,
      href: `/brands/${brand.slug}`,
      description: brand.description,
      logo: brand.logo_image_key
        ? buildStorefrontImage(brand.logo_image_key, brand.name, {
            baseUrl: options.imageBaseUrl,
            delivery: options.delivery,
            sizes: '(min-width: 1024px) 120px, 30vw',
          })
        : null,
      articleCount: counts.articles.get(brand.id) ?? 0,
      productCount: counts.products.get(brand.id) ?? 0,
    })),
  };
}

export interface BrandPageOptions {
  slug: string | undefined;
  responseHeaders: Headers;
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
  currency: string;
}

export type LoadedBrand =
  | { status: 'not_found' }
  | {
      status: 'ok';
      model: BrandPageModel;
      /** 响应缓存标签（品牌 + 关联商品 + 关联文章）。 */
      cacheTagIds: string[];
    };

export async function loadBrandPage(
  db: D1Database,
  options: BrandPageOptions,
): Promise<LoadedBrand> {
  const brand = options.slug ? await getPublishedBrandBySlug(db, options.slug) : null;
  if (!brand) return { status: 'not_found' };

  const [articleIds, productIds] = await Promise.all([
    articlesForBrand(db, brand.id, BRAND_PAGE_ARTICLES),
    productsForBrand(db, brand.id, BRAND_PAGE_PRODUCTS),
  ]);

  // 文章与商品都只展示已发布/在售的（SQL 已过滤，这里保持防御性）。
  const articles: Article[] = articleIds.length > 0 ? await getArticlesByIds(db, articleIds) : [];
  const products = productIds.length > 0 ? await getProductsByIds(db, productIds) : [];

  addCacheTags(options.responseHeaders, [
    ...brandCacheTags([brand.public_id]),
    ...articleCacheTags(articles.map((article) => article.public_id)),
    ...productCacheTags(products.map((product) => product.public_id)),
  ]);

  const imageOptions = {
    baseUrl: options.imageBaseUrl,
    delivery: options.delivery,
  };

  return {
    status: 'ok',
    cacheTagIds: [
      brand.public_id,
      ...articles.map((article) => article.public_id),
      ...products.map((product) => product.public_id),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0),
    model: {
      id: brand.public_id ?? '',
      name: brand.name,
      description: brand.description,
      logo: brand.logo_image_key
        ? buildStorefrontImage(brand.logo_image_key, brand.name, {
            ...imageOptions,
            sizes: '(min-width: 1024px) 120px, 30vw',
          })
        : null,
      articles: articles.map((article) =>
        buildArticleCard(article, { ...imageOptions, sizes: CARD_SIZES }),
      ),
      products: products.map((product) =>
        buildProductCard(product, {
          ...imageOptions,
          currency: options.currency,
          sizes: CARD_SIZES,
          // 品牌页上下文即品牌本身，无需再查关联。
          brand: brand.name,
        }),
      ),
      backHref: '/brands',
    },
  };
}
