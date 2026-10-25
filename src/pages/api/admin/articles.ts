import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createDraft, getArticle } from '../../../features/articles/db';
import { uniqueArticleSlug } from '../../../features/articles/slug';

export const prerender = false;

// POST /api/admin/articles — create an unpublished draft, then send the author
// to the editor. Two steps on purpose: attaching products, brands, and a cover
// needs an article id, so the editor only opens once the row exists.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  if (!title) {
    return redirect(`/admin/articles/new?error=${encodeURIComponent('标题不能为空。')}`, 303);
  }

  const slugBase = String(form.get('slug') ?? '').trim() || title;
  const slug = await uniqueArticleSlug(env.DB, slugBase);
  // The editor URL uses the art_ public ID — one read-back after the insert.
  const id = await createDraft(env.DB, { title, slug });
  const created = await getArticle(env.DB, id);
  return redirect(`/admin/articles/${created?.public_id}/edit`, 303);
};
