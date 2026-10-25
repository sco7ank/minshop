import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createBrand, getBrand } from '../../../features/brands/db';
import { uniqueBrandSlug } from '../../../features/brands/slug';

export const prerender = false;

// POST /api/admin/brands — create a brand, then send the author to the editor.
// Two steps on purpose: attaching products and a logo needs a brand id, so the
// editor only opens once the row exists. Brands start unpublished — a draft
// brand never reaches the storefront, and articles cannot link to it yet.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) {
    return redirect(`/admin/brands/new?error=${encodeURIComponent('品牌名不能为空。')}`, 303);
  }

  const slugBase = String(form.get('slug') ?? '').trim() || name;
  const slug = await uniqueBrandSlug(env.DB, slugBase);
  // The editor URL uses the brnd_ public ID — one read-back after the insert.
  const id = await createBrand(env.DB, { name, slug });
  const created = await getBrand(env.DB, id);
  return redirect(`/admin/brands/${created?.public_id}/edit`, 303);
};
