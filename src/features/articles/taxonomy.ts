/**
 * HYPEBEN 资讯分类体系（editorial taxonomy）。
 *
 * 封闭集合——与商品分类（D1 categories 树，运营可管理）不同，资讯频道是编辑
 * 方针的一部分，写在代码里：页头导航、列表筛选、后台下拉都从这里取，保证
 * 全站一致。新增频道只需在这里加一行。
 */

export interface ArticleCategory {
  slug: string;
  label: string;
  /** 频道一句话描述，用于 /articles 页的频道说明。 */
  blurb: string;
}

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  { slug: 'sneakers', label: '球鞋', blurb: '发售、评测与穿搭' },
  { slug: 'fashion', label: '时装', blurb: '秀场、品牌与趋势' },
  { slug: 'new-arrivals', label: '新品', blurb: '上架与联名速递' },
  { slug: 'art-design', label: '艺术设计', blurb: '视觉、空间与创作' },
  { slug: 'music', label: '音乐', blurb: '现场、发行与人物' },
  { slug: 'lifestyle', label: '生活方式', blurb: '城市、旅行与日常' },
];

const BY_SLUG = new Map(ARTICLE_CATEGORIES.map((category) => [category.slug, category]));

export const DEFAULT_ARTICLE_CATEGORY = 'fashion';

export function isArticleCategory(value: string): boolean {
  return BY_SLUG.has(value);
}

export function normalizeArticleCategory(value: string): string {
  return isArticleCategory(value) ? value : DEFAULT_ARTICLE_CATEGORY;
}

export function articleCategoryLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
