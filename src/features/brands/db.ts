import type { D1Database } from '@cloudflare/workers-types';
import { withPublicId } from '../ids/publicId.ts';

/**
 * 品牌（HYPEBEN）数据层。品牌页同时承载：品牌介绍 + 相关报道 + 在售商品。
 * 商品与品牌是多对多（product_brands）——联名商品可属多个品牌。
 */

export interface Brand {
  id: number;
  public_id: string | null;
  name: string;
  slug: string;
  description: string;
  logo_image_key: string | null;
  published: number;
  created_at: string;
}

export interface BrandFields {
  name: string;
  slug: string;
  description: string;
  logo_image_key: string | null;
  published: number;
}

const BRAND_COLUMNS = 'id, public_id, name, slug, description, logo_image_key, published, created_at';

export async function getBrand(db: D1Database, id: number): Promise<Brand | null> {
  return db.prepare(`SELECT ${BRAND_COLUMNS} FROM brands WHERE id = ?`).bind(id).first<Brand>();
}

export async function getBrandByPublicId(
  db: D1Database,
  publicId: string,
): Promise<Brand | null> {
  return db
    .prepare(`SELECT ${BRAND_COLUMNS} FROM brands WHERE public_id = ?`)
    .bind(publicId)
    .first<Brand>();
}

/** 前台：已发布品牌按 slug 读取（草稿 = null = 404）。 */
export async function getPublishedBrandBySlug(
  db: D1Database,
  slug: string,
): Promise<Brand | null> {
  return db
    .prepare(`SELECT ${BRAND_COLUMNS} FROM brands WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<Brand>();
}

/** 后台列表：含草稿。 */
export async function listBrands(db: D1Database, limit = 100): Promise<Brand[]> {
  const { results } = await db
    .prepare(`SELECT ${BRAND_COLUMNS} FROM brands ORDER BY name COLLATE NOCASE LIMIT ?`)
    .bind(limit)
    .all<Brand>();
  return results ?? [];
}

/** 前台品牌列表（品牌索引页）。 */
export async function listPublishedBrands(db: D1Database): Promise<Brand[]> {
  const { results } = await db
    .prepare(
      `SELECT ${BRAND_COLUMNS} FROM brands
        WHERE published = 1 ORDER BY name COLLATE NOCASE`,
    )
    .all<Brand>();
  return results ?? [];
}

/** 商品 → 品牌名（商品卡片/详情展示用；多品牌取第一个）。 */
export async function brandNamesForProducts(
  db: D1Database,
  productIds: number[],
): Promise<Map<number, string>> {
  const ids = [...new Set(productIds.filter(Number.isInteger))];
  const byProduct = new Map<number, string>();
  if (ids.length === 0) return byProduct;
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT pb.product_id AS product_id, b.name AS name
         FROM product_brands pb
         JOIN brands b ON b.id = pb.brand_id
        WHERE pb.product_id IN (${placeholders})
        ORDER BY pb.product_id, pb.position, b.name COLLATE NOCASE`,
    )
    .bind(...ids)
    .all<{ product_id: number; name: string }>();
  for (const row of results ?? []) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, row.name);
  }
  return byProduct;
}

/** 商品 → 品牌链接（商品详情页「品牌」行；多品牌取 position 最前，仅已发布）。 */
export async function brandLinkForProduct(
  db: D1Database,
  productId: number,
): Promise<{ name: string; slug: string; publicId: string | null } | null> {
  const row = await db
    .prepare(
      `SELECT b.name AS name, b.slug AS slug, b.public_id AS public_id
         FROM product_brands pb
         JOIN brands b ON b.id = pb.brand_id
        WHERE pb.product_id = ? AND b.published = 1
        ORDER BY pb.position, b.name COLLATE NOCASE
        LIMIT 1`,
    )
    .bind(productId)
    .first<{ name: string; slug: string; public_id: string | null }>();
  return row ? { name: row.name, slug: row.slug, publicId: row.public_id } : null;
}

/** 品牌的在售商品（保持 position 顺序，只取 active）。 */
export async function productsForBrand(
  db: D1Database,
  brandId: number,
  limit = 24,
): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS id
         FROM product_brands pb
         JOIN products p ON p.id = pb.product_id
        WHERE pb.brand_id = ? AND p.active = 1
        ORDER BY pb.position, p.created_at DESC
        LIMIT ?`,
    )
    .bind(brandId, limit)
    .all<{ id: number }>();
  return (results ?? []).map((row) => row.id);
}

/** 品牌关联的文章 id（品牌页「相关报道」）。 */
export async function articlesForBrand(
  db: D1Database,
  brandId: number,
  limit = 6,
): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id AS id
         FROM article_brands ab
         JOIN articles a ON a.id = ab.article_id
        WHERE ab.brand_id = ? AND a.published = 1
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ?`,
    )
    .bind(brandId, limit)
    .all<{ id: number }>();
  return (results ?? []).map((row) => row.id);
}

export async function createBrand(
  db: D1Database,
  fields: Pick<BrandFields, 'name' | 'slug'>,
): Promise<number> {
  return withPublicId('brand', async (publicId) => {
    const row = await db
      .prepare('INSERT INTO brands (name, slug, public_id) VALUES (?, ?, ?) RETURNING id')
      .bind(fields.name, fields.slug, publicId)
      .first<{ id: number }>();
    return row!.id;
  });
}

export async function updateBrand(
  db: D1Database,
  id: number,
  fields: BrandFields,
): Promise<void> {
  await db
    .prepare(
      `UPDATE brands
          SET name = ?2, slug = ?3, description = ?4, logo_image_key = ?5, published = ?6
        WHERE id = ?1`,
    )
    .bind(id, fields.name, fields.slug, fields.description, fields.logo_image_key, fields.published)
    .run();
}

/** 删除品牌：只删关联行。 */
export async function deleteBrand(db: D1Database, id: number): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM product_brands WHERE brand_id = ?').bind(id),
    db.prepare('DELETE FROM article_brands WHERE brand_id = ?').bind(id),
    db.prepare('DELETE FROM brands WHERE id = ?').bind(id),
  ]);
}

/** 重建品牌的商品关联（品牌编辑页管理，整体替换）。 */
export async function setBrandProducts(
  db: D1Database,
  brandId: number,
  productIds: number[],
): Promise<void> {
  const stmts = [
    db.prepare('DELETE FROM product_brands WHERE brand_id = ?').bind(brandId),
    ...productIds.map((productId, index) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO product_brands (brand_id, product_id, position) VALUES (?, ?, ?)',
        )
        .bind(brandId, productId, index),
    ),
  ];
  await db.batch(stmts);
}

/** 品牌的商品关联（编辑页回显勾选；保存后对比新旧关联做缓存失效）。 */
export async function productLinksForBrand(
  db: D1Database,
  brandId: number,
): Promise<{ id: number; public_id: string | null }[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.public_id AS public_id
         FROM product_brands pb
         JOIN products p ON p.id = pb.product_id
        WHERE pb.brand_id = ?
        ORDER BY pb.position, p.id`,
    )
    .bind(brandId)
    .all<{ id: number; public_id: string | null }>();
  return results ?? [];
}

export interface BrandContentCounts {
  /** brand_id → 已发布文章数。 */
  articles: Map<number, number>;
  /** brand_id → 在售商品数。 */
  products: Map<number, number>;
}

/** 每个品牌的已发布文章数 / 在售商品数（品牌索引页卡片用）。 */
export async function brandContentCounts(db: D1Database): Promise<BrandContentCounts> {
  const [articleRows, productRows] = await Promise.all([
    db
      .prepare(
        `SELECT ab.brand_id AS brand_id, COUNT(*) AS n
           FROM article_brands ab
           JOIN articles a ON a.id = ab.article_id
          WHERE a.published = 1
          GROUP BY ab.brand_id`,
      )
      .all<{ brand_id: number; n: number }>(),
    db
      .prepare(
        `SELECT pb.brand_id AS brand_id, COUNT(*) AS n
           FROM product_brands pb
           JOIN products p ON p.id = pb.product_id
          WHERE p.active = 1
          GROUP BY pb.brand_id`,
      )
      .all<{ brand_id: number; n: number }>(),
  ]);
  return {
    articles: new Map((articleRows.results ?? []).map((row) => [row.brand_id, row.n])),
    products: new Map((productRows.results ?? []).map((row) => [row.brand_id, row.n])),
  };
}
