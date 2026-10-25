import { normalizeArticleCategory, isArticleCategory } from './taxonomy';

/**
 * 文章表单解析（后台编辑器 → 数据层的边界）。
 * 与 parsePageForm 同模式：返回 { data } 或 { error }，绝不抛到 UI。
 */

export const MAX_ARTICLE_TITLE = 120;
export const MAX_ARTICLE_EXCERPT = 300;
export const MAX_ARTICLE_AUTHOR = 60;
export const MAX_ARTICLE_BODY = 100_000;

export interface ArticleFormData {
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  category: string;
  cover_image_key: string | null;
  body_markdown: string;
  featured: number;
  published: number;
}

export type ArticleFormResult = { data: ArticleFormData } | { error: string };

export function parseArticleForm(form: FormData): ArticleFormResult {
  const title = String(form.get('title') ?? '').trim();
  if (!title) return { error: '标题不能为空。' };
  if (title.length > MAX_ARTICLE_TITLE) {
    return { error: `标题过长（最多 ${MAX_ARTICLE_TITLE} 字符）。` };
  }

  const slug = String(form.get('slug') ?? '').trim();
  const excerpt = String(form.get('excerpt') ?? '').trim();
  if (excerpt.length > MAX_ARTICLE_EXCERPT) {
    return { error: `摘要过长（最多 ${MAX_ARTICLE_EXCERPT} 字符）。` };
  }

  const author = String(form.get('author') ?? '').trim();
  if (author.length > MAX_ARTICLE_AUTHOR) {
    return { error: `作者名过长（最多 ${MAX_ARTICLE_AUTHOR} 字符）。` };
  }

  const rawCategory = String(form.get('category') ?? '').trim();
  if (rawCategory && !isArticleCategory(rawCategory)) {
    return { error: '未知的资讯频道。' };
  }

  const cover = String(form.get('cover_image_key') ?? '').trim();

  const body = String(form.get('body_markdown') ?? '');
  if (body.length > MAX_ARTICLE_BODY) {
    return { error: `正文过长（最多 ${MAX_ARTICLE_BODY} 字符）。` };
  }

  return {
    data: {
      title,
      slug,
      excerpt,
      author,
      category: normalizeArticleCategory(rawCategory),
      cover_image_key: cover || null,
      body_markdown: body,
      featured: form.get('featured') === 'on' || form.get('featured') === '1' ? 1 : 0,
      published: form.get('published') === 'on' || form.get('published') === '1' ? 1 : 0,
    },
  };
}
