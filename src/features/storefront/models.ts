/**
 * Presentation models for store-owned templates.
 *
 * These are the ONLY shapes an editable storefront file receives. Database rows
 * are deliberately absent: a row would publish internal numeric IDs, storage
 * keys, mutable columns, and query-specific accidents as a de facto contract,
 * and every one of those becomes something a template edit can break.
 *
 * Two rules govern what belongs here:
 *
 * 1. Values arrive resolved. A template never derives an R2 URL, calculates
 *    money, infers stock from a quantity, or constructs an API path.
 * 2. The contract stays as small as the default template needs. Every field is
 *    a compatibility promise; an unused one is a promise bought for nothing.
 */

/**
 * A fully resolved image. Never an image key and never an unresolved delivery
 * choice: `src`/`srcset` already reflect the store's original-vs-Cloudflare
 * setting and the usage's width ladder, decided in the builder where that
 * setting is known.
 */
export interface StorefrontImage {
  /** Root-relative or absolute URL; never an R2 key. */
  src: string;
  /** Responsive candidates, when the delivery mode produces a ladder. */
  srcset?: string;
  /** Browser sizing hint paired with `srcset`. */
  sizes?: string;
  alt: string;
  /**
   * Marks the page's likely LCP image. Upstream decides this, because it
   * selects both the wider fallback candidate and the eager/high-priority
   * attributes — a template that could set one without the other would be able
   * to silently regress LCP.
   */
  priority: boolean;
}

/** A product as a catalog/search/recommendation card. */
export interface ProductCardModel {
  /** `prod_` public ID. Never a row ID. */
  id: string;
  name: string;
  /** Root-relative product URL. */
  href: string;
  image: StorefrontImage;
  /** Server-formatted price in the store's currency. Display only — money is
   *  never posted back from a template as authority. */
  formattedPrice: string;
  /** Availability as a boolean, deliberately not a quantity: exact stock counts
   *  stay private, and bucket-level changes avoid cache invalidation. */
  inStock: boolean;
  /** Brand name when the product is linked to one (HYPEBEN); null = 未关联。 */
  brand: string | null;
}

/** An article as a card (home rails, lists, related stories). */
export interface ArticleCardModel {
  /** `art_` public ID. */
  id: string;
  title: string;
  href: string;
  /** 封面图；无封面时为 null，模板负责占位。 */
  image: StorefrontImage | null;
  /** 频道标签（如「球鞋」），已解析为中文。 */
  category: string;
  /** 频道 slug，用于链接 /articles?category=… */
  categorySlug: string;
  excerpt: string;
  author: string;
  /** 展示用发布时间（如「2026-10-20」），空串 = 未发布（不应出现在前台）。 */
  date: string;
  /** 编辑精选标记。 */
  featured: boolean;
}

/** 文章详情页模型。 */
export interface ArticleDetailModel {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  categorySlug: string;
  date: string;
  /** 封面图（LCP）。 */
  image: StorefrontImage | null;
  /** 已渲染、已转义的正文 HTML（renderMarkdown，html:false）。 */
  html: string;
  /** 相关品牌（指向 /brands/<slug>）。 */
  brands: StorefrontLink[];
  /** 关联商品（「Shop this story」）。 */
  products: ProductCardModel[];
  /** 推荐文章。 */
  related: ArticleCardModel[];
  /** 返回资讯列表的链接。 */
  backHref: string;
}

/** 品牌页模型：介绍 + 相关报道 + 在售商品。 */
export interface BrandPageModel {
  id: string;
  name: string;
  description: string;
  logo: StorefrontImage | null;
  articles: ArticleCardModel[];
  products: ProductCardModel[];
  backHref: string;
}

/** 品牌索引页卡片。 */
export interface BrandSummaryModel {
  /** `brnd_` public ID。 */
  id: string;
  name: string;
  href: string;
  description: string;
  logo: StorefrontImage | null;
  articleCount: number;
  productCount: number;
}

/** 品牌索引页模型。 */
export interface BrandsIndexModel {
  brands: BrandSummaryModel[];
}

/** 资讯列表页模型。 */
export interface ArticlesListModel {
  /** 频道 chips（含每频道已发布文章数）。 */
  categories: Array<{
    slug: string;
    label: string;
    blurb: string;
    count: number;
    href: string;
    current: boolean;
  }>;
  currentCategory: string | null;
  currentCategoryLabel: string | null;
  /** 无频道筛选时的头条文章（取自列表第一篇）。 */
  lead: ArticleCardModel | null;
  /** 网格文章（不含头条）。 */
  articles: ArticleCardModel[];
  total: number;
  pagination: StorefrontPaginationModel;
}
/** DISCOVER 首页（编辑部 × 商城融合）模型。 */
export interface HomeExperienceModel {
  /** 头条文章（编辑精选中最新，或最新文章）。 */
  lead: ArticleCardModel | null;
  /** 编辑精选（次级大图位）。 */
  featured: ArticleCardModel[];
  /** 最新资讯。 */
  latest: ArticleCardModel[];
  /** 新品上架（商品轨）。 */
  products: ProductCardModel[];
  /** 顶层分类 chips。 */
  categories: StorefrontLink[];
  /** 品牌条（取有封面的前几个）。 */
  brands: Array<{ name: string; href: string }>;
}

/** A resolved navigation link. Targets are validated upstream, so a template
 *  never renders a dead link or has to ask whether one is publishable. */
export interface StorefrontLink {
  text: string;
  href: string;
}

/**
 * Everything the header and footer need, for every route that renders them.
 *
 * The shell is not browse-only: it wraps cart, checkout, payment, account, and
 * Admin login too. So this model is deliberately inert — links, labels, and
 * flags. Nothing here can start a request or change state.
 */
export interface StorefrontShellModel {
  storeName: string;
  /** Resolved header logo, or null to fall back to the store name as text. */
  logo: StorefrontImage | null;
  /** Escaped message plus an already-validated link, or null when unset. */
  announcement: { text: string; href: string | null } | null;
  headerLinks: StorefrontLink[];
  footerLinks: StorefrontLink[];
  /** Form action plus the current query, so the field repopulates on /search. */
  search: { action: string; query: string };
  cart: { enabled: boolean; href: string };
  account: { enabled: boolean; href: string };
  /** HYPEBEN 双模式：当前所处模式（由路径推导）。 */
  mode: 'discover' | 'shop';
  /** 双模式切换器：两种模式的展示名与模式首页（模板不做任何路径推导）。 */
  modeLabels: Record<'discover' | 'shop', string>;
  modeHomes: Record<'discover' | 'shop', string>;
  /** 资讯频道（全部；页脚渲染全部，页头取前几个）。 */
  channels: StorefrontLink[];
  /** 商城模式导航用的顶层分类（来自 D1，运营可管理）。 */
  categoryLinks: StorefrontLink[];
}

/** One sort control. `current` marks the field the list is ordered by; clicking
 *  it again flips direction, which is why `href` already carries the flip. */
export interface StorefrontSortOption {
  label: string;
  href: string;
  current: boolean;
  /** Direction currently applied, on the current option only. */
  direction: 'asc' | 'desc' | null;
}

export interface StorefrontSortModel {
  options: StorefrontSortOption[];
}

/** A page link, or an elision gap when `page` is null. */
export interface StorefrontPaginationItem {
  page: number | null;
  href: string | null;
  current: boolean;
}

export interface StorefrontPaginationModel {
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
  /** Windowed page list, gaps included — e.g. 1 … 4 5 6 … 20. */
  items: StorefrontPaginationItem[];
}

/**
 * The catalog, rendered at both `/` and `/products`.
 *
 * Every URL here is already built and bounded. A template neither parses query
 * parameters nor constructs them: page and sort links carry the exact query
 * semantics the catalog depends on, including dropping defaults so the canonical
 * URL stays clean and cacheable.
 */
export interface CatalogPageModel {
  eyebrow: string;
  heading: string;
  categories: StorefrontLink[];
  products: ProductCardModel[];
  sort: StorefrontSortModel;
  pagination: StorefrontPaginationModel;
}

/**
 * One gallery image. `anchor` is the in-page target the thumbnails link to and
 * the variant selector points at — a `pimg_` public ID (the object key only as
 * a pre-backfill fallback), never a row ID.
 */
export interface StorefrontGalleryImage {
  anchor: string;
  hero: StorefrontImage;
  thumbnail: StorefrontImage;
}

/** A selectable variant. `priceCents` is present because the live price script
 *  reads it; it is display-only, and the server recomputes every total. */
export interface StorefrontVariant {
  id: string;
  label: string;
  formattedPrice: string;
  priceCents: number;
  soldOut: boolean;
  /** The first in-stock variant, pre-selected so the form is submittable. */
  defaultSelected: boolean;
  /** Gallery anchor to scroll to when this variant is chosen; '' when none. */
  imageAnchor: string;
}

/** A checkbox add-on layered on the line price. */
export interface StorefrontExtra {
  id: string;
  label: string;
  formattedPriceDelta: string;
  priceDeltaCents: number;
}

/**
 * Everything the purchase controls need, with every decision already made.
 *
 * A template must not receive stock quantities or re-derive which buttons to
 * show: `soldOut` already accounts for variant-level inventory, and
 * `showAddToCart`/`showBuyNow` already fold in the store's runtime cart and
 * buy-now toggles and whether any payment rail can actually take money.
 */
export interface ProductPurchaseModel {
  /** `prod_` public ID, submitted by both forms. */
  productId: string;
  cartAction: string;
  expressAction: string;
  hasOptions: boolean;
  soldOut: boolean;
  showAddToCart: boolean;
  showBuyNow: boolean;
  /** Merchant's name for the variant group, e.g. "Size". */
  variantLabel: string | null;
  variants: StorefrontVariant[];
  extras: StorefrontExtra[];
}

/** Metadata the ROUTE emits. Never handed to a template: escaping and canonical
 *  correctness are not presentation decisions. */
export interface ProductSeoModel {
  title: string;
  description: string | null;
  /** Root-relative image path for the social card. */
  imagePath: string;
  /** Serialized JSON-LD, already escaped for embedding in a script tag. */
  jsonLd: string;
}

export interface ProductDetailModel {
  id: string;
  name: string;
  /** Raw Markdown source (also what the catalog API returns). */
  description: string | null;
  /** Rendered, sanitized HTML (renderMarkdown: raw HTML escaped, schemes
   *  filtered). Themes show THIS, inside their .markdown-content prose styles —
   *  never the raw source. */
  descriptionHtml: string | null;
  /** Lowest variant price when they differ, else the product price. */
  formattedPrice: string;
  /** Raw minor units for the live price script; display-only. */
  priceCents: number;
  currency: string;
  /** True when variants disagree on price, so the header reads "from …". */
  priceVaries: boolean;
  soldOut: boolean;
  /** Low-stock nudge, already gated: never set for a product with variants. */
  lowStock: boolean;
  digitalDelivery: boolean;
  categories: StorefrontLink[];
  /** More than one image means the gallery renderer; one or none is the single
   *  hero. The distinction is the template's to make. */
  images: StorefrontGalleryImage[];
  /** Hero for the single-image case, already resolved. */
  heroImage: StorefrontImage;
  related: ProductCardModel[];
  /** 关联品牌（指向 /brands/<slug>）；未关联时为 null。 */
  brand: StorefrontLink | null;
  /** 关联报道（资讯 ↔ 商品双向关联的「商品挂报道」侧）。 */
  stories: ArticleCardModel[];
  /** Where "back to shop" goes — the catalog, wherever the merchant put it. */
  backHref: string;
  /** Validated message from ?error=, or null. */
  error: string | null;
}

/**
 * A merchant-authored content page.
 *
 * `html` is ALREADY rendered from Markdown and sanitized. A template embeds it
 * and does not parse, re-sanitize, or transform it: the trusted-HTML boundary
 * is upstream, and moving any part of it into an editable file would move the
 * XSS surface with it.
 */
export interface ContentPageModel {
  title: string;
  /** Rendered, sanitized page body. */
  html: string;
  /** Layout preset key, exposed as a data attribute so presets can target it. */
  layout: string;
  /** Inline custom properties for the preset's measure and title alignment. */
  layoutStyle: string;
}
