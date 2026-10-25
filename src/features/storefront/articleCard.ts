import type { Article } from '../articles/db';
import type { ArticleCardModel } from './models';
import { buildStorefrontImage, type StorefrontImageOptions } from './productCard';
import { articleCategoryLabel } from '../articles/taxonomy';

/**
 * 文章卡片构建器：与 buildProductCard 同规则——模板不算 URL、不格式化日期、
 * 不解析频道。published_at 为空的文章不应出现在前台，date 留空由模板降级。
 *
 * 日期用 zh-CN 中等格式（「2026年10月20日」）——HYPEBEN 是中文站。
 */
export function formatArticleDate(value: string | null | undefined): string {
  if (!value) return '';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date);
  } catch {
    return value.slice(0, 10);
  }
}

export function buildArticleCard(
  article: Pick<
    Article,
    'public_id' | 'title' | 'slug' | 'excerpt' | 'cover_image_key' | 'author' | 'category' | 'featured' | 'published_at'
  >,
  options: StorefrontImageOptions = {},
): ArticleCardModel {
  return {
    id: article.public_id ?? '',
    title: article.title,
    href: `/articles/${article.slug}`,
    image: article.cover_image_key
      ? buildStorefrontImage(article.cover_image_key, article.title, options)
      : null,
    category: articleCategoryLabel(article.category),
    categorySlug: article.category,
    excerpt: article.excerpt,
    author: article.author,
    date: formatArticleDate(article.published_at),
    featured: article.featured === 1,
  };
}
