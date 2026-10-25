import { describe, it, expect } from 'vitest';
import { sitemapLocs } from './sitemap.xml';

const origin = 'https://shop.example';
const data = {
  categories: [{ slug: 'hats' }],
  products: [{ slug: 'beanie' }],
  pages: [{ slug: 'about' }],
  articles: [{ slug: 'drop-report' }],
  brands: [{ slug: 'acme' }],
};

describe('sitemapLocs', () => {
  // HYPEBEN: `/` is the editorial home; the catalog has its own address.
  it('lists / and /products while the home page is the editorial home', () => {
    const locs = sitemapLocs(origin, null, data);
    expect(locs).toContain(`${origin}/`);
    expect(locs).toContain(`${origin}/products`);
  });

  // With `/` taken over, it renders the chosen target and canonicals to it — so
  // listing `/` would be a non-canonical duplicate of a URL already in the
  // sitemap; the catalog stays at /products regardless.
  it('drops / once the home page is overridden', () => {
    const locs = sitemapLocs(origin, 'page:3', data);
    expect(locs).not.toContain(`${origin}/`);
    expect(locs).toContain(`${origin}/products`);
  });

  it('covers every category, product, page, article, and brand', () => {
    const locs = sitemapLocs(origin, null, data);
    expect(locs).toContain(`${origin}/categories/hats`);
    expect(locs).toContain(`${origin}/products/beanie`);
    expect(locs).toContain(`${origin}/pages/about`);
    expect(locs).toContain(`${origin}/articles/drop-report`);
    expect(locs).toContain(`${origin}/brands/acme`);
    expect(locs).toHaveLength(9);
  });

  it('never emits a duplicate URL', () => {
    for (const home of [null, 'page:3', 'product:9']) {
      const locs = sitemapLocs(origin, home, data);
      expect(new Set(locs).size).toBe(locs.length);
    }
  });
});
