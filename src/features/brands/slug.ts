/**
 * 品牌 slug：与文章/页面同规则（小写连字符），冲突自动追加 -2/-3。
 */

const RESERVED = new Set(['new', 'edit', 'index']);

export function brandSlugify(input: string): string {
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

export async function uniqueBrandSlug(
  db: D1Database,
  base: string,
  excludeId?: number,
): Promise<string> {
  const root = brandSlugify(base) || 'brand';
  let candidate = root;
  let suffix = 1;
  while (true) {
    const row = await db
      .prepare('SELECT id FROM brands WHERE slug = ?')
      .bind(candidate)
      .first<{ id: number }>();
    if (!row || row.id === excludeId) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}
