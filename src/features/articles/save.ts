import type { D1Database } from '@cloudflare/workers-types';
import { findMediaByKeys } from '../media/db.ts';
import { extractMediaKeys } from '../pages/markdown.ts';
import type { Article } from './db.ts';
import { articleMediaClaimStatements } from './db.ts';
import type { ArticleFormData } from './form.ts';

export interface ArticleSaveResult {
  /** 正文引用但媒体库中不存在的图片键。 */
  unresolved: string[];
  /** 请求发布但因媒体缺失被拒。 */
  publishRefused: boolean;
  /** 实际存储的发布状态。 */
  published: number;
}

/**
 * 持久化文章：正文 + 媒体关联 + 商品/品牌关联 + 发布决策，一个事务。
 *
 * 发布决策复刻 savePageBody 的安全语义：缺图不阻止保存，只阻止草稿上线；
 * 已发布文章永不被静默撤下。published_at 仅在首次发布时落时间。
 */
export async function saveArticleBody(
  db: D1Database,
  existing: Article,
  fields: ArticleFormData & {
    productIds?: number[];
    brandIds?: number[];
  },
  options: { baseUrl?: string } = {},
): Promise<ArticleSaveResult> {
  const referenced = extractMediaKeys(fields.body_markdown, { baseUrl: options.baseUrl });
  if (fields.cover_image_key) referenced.push(fields.cover_image_key);
  const resolved = await findMediaByKeys(db, referenced);
  const resolvedKeys = new Set(resolved.map((m) => m.image_key));
  const unresolved = referenced.filter((key) => !resolvedKeys.has(key));
  const coverResolved = !fields.cover_image_key || resolvedKeys.has(fields.cover_image_key);

  const wantsPublish = fields.published === 1;
  const blockedValue = wantsPublish ? existing.published : 0;
  const okValue = unresolved.length === 0 && coverResolved ? fields.published : blockedValue;

  await db.batch([
    ...articleMediaClaimStatements(
      db,
      existing.id,
      resolved.map((m) => m.id),
    ),
    db
      .prepare('DELETE FROM article_products WHERE article_id = ?1')
      .bind(existing.id),
    ...(fields.productIds ?? []).map((productId, index) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO article_products (article_id, product_id, position) VALUES (?1, ?2, ?3)',
        )
        .bind(existing.id, productId, index),
    ),
    db.prepare('DELETE FROM article_brands WHERE article_id = ?1').bind(existing.id),
    ...(fields.brandIds ?? []).map((brandId) =>
      db
        .prepare('INSERT OR IGNORE INTO article_brands (article_id, brand_id) VALUES (?1, ?2)')
        .bind(existing.id, brandId),
    ),
    db
      .prepare(
        `UPDATE articles
            SET title = ?2,
                slug = ?3,
                excerpt = ?4,
                body_markdown = ?5,
                cover_image_key = ?6,
                author = ?7,
                category = ?8,
                featured = ?9,
                published = ?10,
                published_at = CASE
                  WHEN ?10 = 1 AND published_at IS NULL THEN datetime('now')
                  ELSE published_at END,
                updated_at = datetime('now')
          WHERE id = ?1`,
      )
      .bind(
        existing.id,
        fields.title,
        fields.slug,
        fields.excerpt,
        fields.body_markdown,
        fields.cover_image_key,
        fields.author,
        fields.category,
        fields.featured,
        okValue,
      ),
  ]);

  const saved = await db
    .prepare('SELECT published FROM articles WHERE id = ?')
    .bind(existing.id)
    .first<{ published: number }>();
  const published = saved?.published ?? blockedValue;

  return {
    unresolved,
    publishRefused: wantsPublish && published !== 1,
    published,
  };
}

/** 后台提示语（与 saveWarning 同风格）。 */
export function articleSaveWarning(result: ArticleSaveResult): string {
  if (result.unresolved.length === 0 && !result.publishRefused) return '';
  const count = Math.max(result.unresolved.length, 1);
  const images = `${count} 张图片`;
  if (result.publishRefused) {
    return `已保存，但文章未发布：${images}不在媒体库中。`;
  }
  if (result.published === 1) {
    return `已保存并上线，但 ${images}不在媒体库中，将显示为裂图。`;
  }
  return `草稿已保存，但 ${images}不在媒体库中。`;
}
