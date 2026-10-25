import type { BrandFields } from './db';

/**
 * 品牌表单解析（后台编辑器 → 数据层的边界）。
 * 与 parseArticleForm 同模式：返回 { data } 或 { error }，绝不抛到 UI。
 */

export const MAX_BRAND_NAME = 60;
export const MAX_BRAND_DESCRIPTION = 2000;

export interface BrandFormData {
  name: string;
  slug: string;
  description: string;
  logo_image_key: string | null;
  published: number;
}

export type BrandFormResult = { data: BrandFormData } | { error: string };

export function parseBrandForm(form: FormData): BrandFormResult {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: '品牌名不能为空。' };
  if (name.length > MAX_BRAND_NAME) {
    return { error: `品牌名过长（最多 ${MAX_BRAND_NAME} 字符）。` };
  }

  const slug = String(form.get('slug') ?? '').trim();

  const description = String(form.get('description') ?? '');
  if (description.length > MAX_BRAND_DESCRIPTION) {
    return { error: `品牌介绍过长（最多 ${MAX_BRAND_DESCRIPTION} 字符）。` };
  }

  const logo = String(form.get('logo_image_key') ?? '').trim();

  return {
    data: {
      name,
      slug,
      description,
      logo_image_key: logo || null,
      published: form.get('published') === 'on' || form.get('published') === '1' ? 1 : 0,
    } satisfies BrandFields,
  };
}
