import type { MenuItem } from '../navigation/db';
import type { Category } from '../categories/db';
import { mediaUrl } from '../media/url';
import { ARTICLE_CATEGORIES } from '../articles/taxonomy';
import { MODE_LABELS, modeHomePath, type BrowseMode } from './mode';
import type { StorefrontLink, StorefrontShellModel } from './models';

/**
 * Builds the header/footer model.
 *
 * Pure by construction: everything it needs is passed in, already loaded. The
 * shell renders on every document route including checkout and the pay page, so
 * adding a query here would put a database round trip on the critical path of
 * the routes least able to afford one. Settings, menus and the top-level
 * category nav arrive from the single batched read middleware already performs.
 */
export interface ShellInput {
  storeName: string;
  /** Header logo object key, or null for the text fallback. */
  logoImageKey: string | null;
  /** config.images.baseUrl — empty string keeps `/images/...` delivery. */
  imageBaseUrl: string;
  /** Empty message means "no announcement"; the message is its own switch. */
  announcement: string;
  /** Already validated upstream. Empty string renders the text unlinked. */
  announcementHref: string;
  /** Menu items, already filtered to the publishable ones. */
  headerItems: MenuItem[];
  footerItems: MenuItem[];
  /** Current search term, normalized, or '' when not on the search route. */
  searchQuery: string;
  cartEnabled: boolean;
  accountsEnabled: boolean;
  /** Current browsing mode, derived from the request path. */
  mode: BrowseMode;
  /** Top-level categories for the shop-mode nav (raw rows; filtered here). */
  categories?: Category[];
}

const toLink = (item: MenuItem): StorefrontLink => ({ text: item.text, href: item.href });

export function buildShellModel(input: ShellInput): StorefrontShellModel {
  const topCategories = (input.categories ?? [])
    .filter((category) => category.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((category) => ({ text: category.name, href: `/categories/${category.slug}` }));

  // 资讯频道：封闭频道集（taxonomy），链接带 category 查询参数。
  const channels: StorefrontLink[] = ARTICLE_CATEGORIES.map((category) => ({
    text: category.label,
    href: `/articles?category=${category.slug}`,
  }));

  const modes: BrowseMode[] = ['discover', 'shop'];

  return {
    storeName: input.storeName,
    logo: input.logoImageKey
      ? {
          src: mediaUrl(input.logoImageKey, input.imageBaseUrl),
          alt: input.storeName,
          // The header logo is above the fold on every route, so it is never
          // lazy. It has no responsive ladder — one small asset, no usage
          // variants — which is why it carries no srcset or sizes.
          priority: true,
        }
      : null,
    announcement: input.announcement
      ? { text: input.announcement, href: input.announcementHref || null }
      : null,
    headerLinks: input.headerItems.map(toLink),
    footerLinks: input.footerItems.map(toLink),
    search: { action: '/search', query: input.searchQuery },
    cart: { enabled: input.cartEnabled, href: '/cart' },
    account: { enabled: input.accountsEnabled, href: '/account' },
    mode: input.mode,
    modeLabels: Object.fromEntries(modes.map((mode) => [mode, MODE_LABELS[mode]])) as Record<
      BrowseMode,
      string
    >,
    modeHomes: Object.fromEntries(modes.map((mode) => [mode, modeHomePath(mode)])) as Record<
      BrowseMode,
      string
    >,
    channels,
    categoryLinks: topCategories,
  };
}
