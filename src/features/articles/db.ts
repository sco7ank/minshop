import type { D1Database } from '@cloudflare/workers-types';
import { withPublicId } from '../ids/publicId.ts';

/**
 * 文章（HYPEBEN 资讯）数据层。
 *
 * 模式复刻 features/pages：slug UNIQUE、published 草稿态、markdown 正文、
 * 媒体关联、updated_at 应用维护。前台只读 published=1。
 */

export interface Article {
  id: number;
  public_id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  cover_image_key: string | null;
  author: string;
  category: string;
  featured: number;
  published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleFields {
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  cover_image_key: string | null;
  author: string;
  category: string;
  featured: number;
  published: number;
}

const ARTICLE_COLUMNS = `id, public_id, title, slug, excerpt, body_markdown,
  cover_image_key, author, category, featured, published, published_at,
  created_at, updated_at`;

export async function getArticle(db: D1Database, id: number): Promise<Article | null> {
  return db
    .prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id = ?`)
    .bind(id)
    .first<Article>();
}

export async function getArticleByPublicId(
  db: D1Database,
  publicId: string,
): Promise<Article | null> {
  return db
    .prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE public_id = ?`)
    .bind(publicId)
    .first<Article>();
}

/** 前台：已发布文章按 slug 读取（草稿 = null = 404）。 */
export async function getPublishedArticleBySlug(
  db: D1Database,
  slug: string,
): Promise<Article | null> {
  return db
    .prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<Article>();
}

/** 后台列表：含草稿，updated_at 倒序。 */
export async function listArticles(db: D1Database, limit = 100): Promise<Article[]> {
  const { results } = await db
    .prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles ORDER BY updated_at DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Article>();
  return results ?? [];
}

export interface PublishedArticlePage {
  articles: Article[];
  total: number;
}

/** 前台列表：可选频道过滤，published_at 倒序分页。 */
export async function listPublishedArticles(
  db: D1Database,
  options: { category?: string | null; limit: number; offset: number },
): Promise<PublishedArticlePage> {
  const category = options.category ?? null;
  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM articles
        WHERE published = 1 AND (?1 IS NULL OR category = ?1)`,
    )
    .bind(category)
    .first<{ n: number }>();
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS} FROM articles
        WHERE published = 1 AND (?1 IS NULL OR category = ?1)
        ORDER BY published_at DESC, id DESC
        LIMIT ?2 OFFSET ?3`,
    )
    .bind(category, options.limit, options.offset)
    .all<Article>();
  return { articles: results ?? [], total: countRow?.n ?? 0 };
}

/** 按 id 批量读取已发布文章，返回顺序与入参一致（品牌页「相关报道」用）。 */
export async function getArticlesByIds(db: D1Database, ids: number[]): Promise<Article[]> {
  const unique = [...new Set(ids.filter(Number.isInteger))];
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS} FROM articles
        WHERE id IN (${placeholders}) AND published = 1`,
    )
    .bind(...unique)
    .all<Article>();
  const byId = new Map((results ?? []).map((article) => [article.id, article]));
  return unique.map((id) => byId.get(id)).filter((a): a is Article => a !== undefined);
}

/** 编辑精选（首页大图 / 精选区）：最新发布的 featured 文章。 */
export async function listFeaturedArticles(db: D1Database, limit = 5): Promise<Article[]> {
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS} FROM articles
        WHERE published = 1 AND featured = 1
        ORDER BY published_at DESC, id DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<Article>();
  return results ?? [];
}

/** 每个频道的已发布文章数（列表页频道 chips 用）。 */
export async function publishedCountsByCategory(
  db: D1Database,
): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT category, COUNT(*) AS n FROM articles WHERE published = 1 GROUP BY category`,
    )
    .all<{ category: string; n: number }>();
  const counts = new Map<string, number>();
  for (const row of results ?? []) counts.set(row.category, row.n);
  return counts;
}

/** 文章关联的商品（保持 position 顺序）。 */
export async function productsForArticle(
  db: D1Database,
  articleId: number,
): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT product_id FROM article_products
        WHERE article_id = ? ORDER BY position, product_id`,
    )
    .bind(articleId)
    .all<{ product_id: number }>();
  return (results ?? []).map((row) => row.product_id);
}

/** 商品关联的文章（商品详情页「相关报道」）。 */
export async function articlesForProduct(
  db: D1Database,
  productId: number,
  limit = 3,
): Promise<Article[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.public_id, a.title, a.slug, a.excerpt, a.cover_image_key,
              a.author, a.category, a.published_at
         FROM articles a
         JOIN article_products ap ON ap.article_id = a.id
        WHERE ap.product_id = ? AND a.published = 1
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ?`,
    )
    .bind(productId, limit)
    .all<
      Pick<
        Article,
        | 'id'
        | 'public_id'
        | 'title'
        | 'slug'
        | 'excerpt'
        | 'cover_image_key'
        | 'author'
        | 'category'
        | 'published_at'
      >
    >();
  // 列表视图只需要这些列；补足其余字段为空以满足 Article 形状。
  return (results ?? []).map((row) => ({
    ...row,
    body_markdown: '',
    featured: 0,
    published: 1,
    created_at: '',
    updated_at: '',
  })) as Article[];
}

/** 文章关联的品牌。 */
export async function brandsForArticle(db: D1Database, articleId: number): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT brand_id FROM article_brands WHERE article_id = ? ORDER BY brand_id')
    .bind(articleId)
    .all<{ brand_id: number }>();
  return (results ?? []).map((row) => row.brand_id);
}

/** 同频道的其他已发布文章（详情页「推荐阅读」，排除自身）。 */
export async function relatedArticles(
  db: D1Database,
  article: Article,
  limit = 3,
): Promise<Article[]> {
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS} FROM articles
        WHERE published = 1 AND id != ?1 AND category = ?2
        ORDER BY published_at DESC, id DESC
        LIMIT ?3`,
    )
    .bind(article.id, article.category, limit)
    .all<Article>();
  return results ?? [];
}

export async function createDraft(
  db: D1Database,
  fields: Pick<ArticleFields, 'title' | 'slug'>,
): Promise<number> {
  return withPublicId('article', async (publicId) => {
    const row = await db
      .prepare(
        `INSERT INTO articles (title, slug, public_id) VALUES (?, ?, ?) RETURNING id`,
      )
      .bind(fields.title, fields.slug, publicId)
      .first<{ id: number }>();
    return row!.id;
  });
}

/** 全量更新（后台编辑器保存）。published_at 仅在发布时落时间。 */
export async function updateArticle(
  db: D1Database,
  id: number,
  fields: ArticleFields & { published_at?: string | null },
): Promise<void> {
  await db
    .prepare(
      `UPDATE articles
          SET title = ?2, slug = ?3, excerpt = ?4, body_markdown = ?5,
              cover_image_key = ?6, author = ?7, category = ?8, featured = ?9,
              published = ?10, published_at = ?11, updated_at = datetime('now')
        WHERE id = ?1`,
    )
    .bind(
      id,
      fields.title,
      fields.slug,
      fields.excerpt,
      fields.body_markdown,
      fields.cover_image_key,
      fields.author,
      fields.category,
      fields.featured,
      fields.published,
      fields.published_at ?? null,
    )
    .run();
}

/** 删除文章：只删关联行，媒体文件不动（media 库是唯一可删文件处）。 */
export async function deleteArticle(db: D1Database, id: number): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM article_media WHERE article_id = ?').bind(id),
    db.prepare('DELETE FROM article_products WHERE article_id = ?').bind(id),
    db.prepare('DELETE FROM article_brands WHERE article_id = ?').bind(id),
    db.prepare('DELETE FROM articles WHERE id = ?').bind(id),
  ]);
}

/** 重建文章的商品关联（整体替换，position 即数组顺序）。 */
export async function setArticleProducts(
  db: D1Database,
  articleId: number,
  productIds: number[],
): Promise<void> {
  const stmts = [
    db.prepare('DELETE FROM article_products WHERE article_id = ?').bind(articleId),
    ...productIds.map((productId, index) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO article_products (article_id, product_id, position) VALUES (?, ?, ?)',
        )
        .bind(articleId, productId, index),
    ),
  ];
  await db.batch(stmts);
}

/** 重建文章的品牌关联。 */
export async function setArticleBrands(
  db: D1Database,
  articleId: number,
  brandIds: number[],
): Promise<void> {
  const stmts = [
    db.prepare('DELETE FROM article_brands WHERE article_id = ?').bind(articleId),
    ...brandIds.map((brandId) =>
      db
        .prepare('INSERT OR IGNORE INTO article_brands (article_id, brand_id) VALUES (?, ?)')
        .bind(articleId, brandId),
    ),
  ];
  await db.batch(stmts);
}

/** 文章正文引用的媒体声明（与 save 同事务，见 save.ts）。 */
export function articleMediaClaimStatements(
  db: D1Database,
  articleId: number,
  mediaIds: number[],
): D1PreparedStatement[] {
  const stmts = [
    db.prepare('DELETE FROM article_media WHERE article_id = ?').bind(articleId),
    ...mediaIds.map((mediaId) =>
      db
        .prepare('INSERT OR IGNORE INTO article_media (article_id, media_id) VALUES (?, ?)')
        .bind(articleId, mediaId),
    ),
  ];
  return stmts;
}
