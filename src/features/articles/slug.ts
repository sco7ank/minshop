/**
 * 文章 slug：与 pages 同规则（小写连字符、禁保留词由 UNIQUE 约束兜底），
 * 新建草稿时若与既有文章冲突自动追加 -2/-3。
 */

const RESERVED = new Set(['new', 'edit', 'preview', 'index']);

export function articleSlugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!base || RESERVED.has(base)) return '';
  return base;
}

export async function uniqueArticleSlug(
  db: D1Database,
  base: string,
  excludeId?: number,
): Promise<string> {
  const root = articleSlugify(base) || 'article';
  let candidate = root;
  let suffix = 1;
  // 有界循环：后缀递增直到无冲突（文章量级下 2-3 次即止）。
  while (true) {
    const row = await db
      .prepare('SELECT id FROM articles WHERE slug = ?')
      .bind(candidate)
      .first<{ id: number }>();
    if (!row || row.id === excludeId) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}
