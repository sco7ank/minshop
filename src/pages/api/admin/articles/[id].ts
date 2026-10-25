import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../../config';
import { getArticleByPublicId, deleteArticle, getArticle } from '../../../../features/articles/db';
import { parseArticleForm } from '../../../../features/articles/form';
import { uniqueArticleSlug } from '../../../../features/articles/slug';
import { saveArticleBody, articleSaveWarning } from '../../../../features/articles/save';
import { parsePublicId } from '../../../../features/ids/publicId';
import { getProductsByPublicIds } from '../../../../features/products/db';
import { listBrands } from '../../../../features/brands/db';
import { CACHE_TAG, articleCacheTags, brandCacheTags, productCacheTags } from '../../../../features/cache/tags';
import { purgeCacheTags } from '../../../../features/cache/purge';

export const prerender = false;

// POST /api/admin/articles/:id — save, or delete when `_action=delete`.
// :id is the art_ public ID; numeric row ids are not accepted.
export const POST: APIRoute = async ({ request, params, redirect }) => {
  const publicId = parsePublicId(params.id, 'article');
  const existing = publicId ? await getArticleByPublicId(env.DB, publicId) : null;
  if (!existing) return new Response('Not found', { status: 404 });
  const id = existing.id;

  const form = await request.formData();

  if (String(form.get('_action')) === 'delete') {
    // Drops the article and its media/product/brand associations. The files
    // stay in the library.
    await deleteArticle(env.DB, id);
    await purgeCacheTags([
      CACHE_TAG.shell,
      ...articleCacheTags([existing.public_id]),
      ...productCacheTags(form.getAll('product').map((v) => String(v))),
      ...brandCacheTags(form.getAll('brand').map((v) => String(v))),
    ]);
    return redirect('/admin/articles', 303);
  }

  const back = (query: string) => redirect(`/admin/articles/${publicId}/edit${query}`, 303);

  const parsed = parseArticleForm(form);
  if ('error' in parsed) return back(`?error=${encodeURIComponent(parsed.error)}`);

  // Keep the slug stable on rename: the form pre-fills the current slug.
  const slugBase = parsed.data.slug || existing.slug || parsed.data.title;
  const slug = await uniqueArticleSlug(env.DB, slugBase, id);

  // 关联商品 / 关联品牌以公共 ID 提交，服务端解析回行 id。
  const productPublicIds = form
    .getAll('product')
    .map((v) => parsePublicId(v, 'product'))
    .filter((v): v is string => v !== null);
  const productRows = await getProductsByPublicIds(env.DB, productPublicIds);
  const productIds = productRows.map((p) => p.id);

  const brandPublicIds = form
    .getAll('brand')
    .map((v) => parsePublicId(v, 'brand'))
    .filter((v): v is string => v !== null);
  // 品牌下拉只列已发布的；草稿品牌 id 解析不到，自然被忽略。
  const publishedBrands = (await listBrands(env.DB)).filter((b) => b.published === 1);
  const brandByPublicId = new Map(publishedBrands.map((b) => [b.public_id, b.id]));
  const brandIds = brandPublicIds
    .map((pid) => brandByPublicId.get(pid))
    .filter((v): v is number => typeof v === 'number');

  const result = await saveArticleBody(
    env.DB,
    existing,
    { ...parsed.data, slug, productIds, brandIds },
    { baseUrl: getConfig().images.baseUrl },
  );

  // 文章页、商品页（相关报道段）、品牌页（相关报道段）与 shell（频道计数）都
  // 可能因本次保存而改变，一并失效。
  const saved = await getArticle(env.DB, id);
  await purgeCacheTags([
    CACHE_TAG.shell,
    ...articleCacheTags([saved?.public_id ?? existing.public_id]),
    ...productCacheTags([...productIds.length ? productRows.map((p) => p.public_id) : [], existing.public_id]),
    ...brandCacheTags(brandPublicIds),
  ]);

  const warning = articleSaveWarning(result);
  return back(warning ? `?warning=${encodeURIComponent(warning)}` : '?saved=1');
};
