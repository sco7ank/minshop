/**
 * HYPEBEN 双模式浏览：DISCOVER（潮流资讯）与 SHOP（潮流商城）。
 *
 * 模式由当前路径推导——不需要会话状态，链接可分享、刷新不丢失。切换入口
 * 固定在页头（页头在每一个页面渲染，包括文章详情、商品详情、品牌页），
 * 点击即进入对应模式的首页；购物车、用户会话、语言与模式无关，天然保留。
 */

export type BrowseMode = 'discover' | 'shop';

/** 属于商城模式的路径前缀。其余（首页、资讯、品牌、账号、内容页）归资讯模式。 */
const SHOP_PREFIXES = [
  '/products',
  '/categories',
  '/cart',
  '/checkout',
  '/express',
  '/pay',
  '/order',
  '/search',
];

export function modeForPath(pathname: string): BrowseMode {
  return SHOP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? 'shop'
    : 'discover';
}

/** 模式首页：资讯模式的入口是编辑部首页，商城模式的入口是商品目录。 */
export function modeHomePath(mode: BrowseMode): string {
  return mode === 'shop' ? '/products' : '/';
}

export const MODE_LABELS: Record<BrowseMode, string> = {
  discover: '资讯',
  shop: '商城',
};

/** 切换到另一模式时保留的返回入口（供页头 toggle 的 aria-label 使用）。 */
export function otherMode(mode: BrowseMode): BrowseMode {
  return mode === 'shop' ? 'discover' : 'shop';
}
