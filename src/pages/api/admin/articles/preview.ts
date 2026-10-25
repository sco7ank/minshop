import type { APIRoute } from 'astro';
import { getConfig } from '../../../../config';
import { renderMarkdown } from '../../../../features/pages/markdown';

export const prerender = false;

const MAX_BODY = 100_000; // same bound the article form enforces

/**
 * POST /api/admin/articles/preview — render Markdown with the REAL storefront
 * renderer and return the fragment.
 *
 * Same contract as the page editor's preview: the browser never parses
 * Markdown, so preview and storefront cannot drift. sourceMap stamps
 * data-source-line so a click in the preview jumps to the source line.
 *
 * A static filename beats the sibling [id].ts route, so this never collides
 * with an article whose id is "preview".
 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const markdown = String(form.get('body_markdown') ?? '').slice(0, MAX_BODY);
  const html = renderMarkdown(markdown, {
    baseUrl: getConfig().images.baseUrl,
    sourceMap: true,
  });
  const wrapped = `<div class="markdown-content">${html}</div>`;

  return new Response(wrapped, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
};
