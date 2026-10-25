import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteBrand, getBrandByPublicId, productLinksForBrand, setBrandProducts, updateBrand } from '../../../../features/brands/db';
import { parseBrandForm } from '../../../../features/brands/form';
import { uniqueBrandSlug } from '../../../../features/brands/slug';
import { parsePublicId } from '../../../../features/ids/publicId';
import { getProductsByPublicIds } from '../../../../features/products/db';
import { CACHE_TAG, brandCacheTags, productCacheTags } from '../../../../features/cache/tags';
import { purgeCacheTags } from '../../../../features/cache/purge';

export const prerender = false;

// POST /api/admin/brands/:id — save, or delete when `_action=delete`.
// :id is the brnd_ public ID; numeric row ids are not accepted.
export const POST: APIRoute = async ({ request, params, redirect }) => {
  const publicId = parsePublicId(params.id, 'brand');
  const existing = publicId ? await getBrandByPublicId(env.DB, publicId) : null;
  if (!existing) return new Response('Not found', { status: 404 });
  const id = existing.id;

  const form = await request.formData();

  if (String(form.get('_action')) === 'delete') {
    // Drops the brand and its product/article associations. Linked products
    // keep existing — only the join rows go.
    const linked = await productLinksForBrand(env.DB, id);
    await deleteBrand(env.DB, id);
    await purgeCacheTags([
      CACHE_TAG.shell,
      ...brandCacheTags([existing.public_id]),
      ...productCacheTags(linked.map((p) => p.public_id)),
    ]);
    return redirect('/admin/brands', 303);
  }

  const back = (query: string) => redirect(`/admin/brands/${publicId}/edit${query}`, 303);

  const parsed = parseBrandForm(form);
  if ('error' in parsed) return back(`?error=${encodeURIComponent(parsed.error)}`);

  // Keep the slug stable on rename: the form pre-fills the current slug.
  const slugBase = parsed.data.slug || existing.slug || parsed.data.name;
  const slug = await uniqueBrandSlug(env.DB, slugBase, id);

  await updateBrand(env.DB, id, { ...parsed.data, slug });

  // 关联商品以公共 ID 提交，服务端解析回行 id（仅 active 商品可挂）。
  const productPublicIds = form
    .getAll('product')
    .map((v) => parsePublicId(v, 'product'))
    .filter((v): v is string => v !== null);
  const productRows = await getProductsByPublicIds(env.DB, productPublicIds);
  // 旧关联先读后写：重建后 product_brands 只剩新行。
  const previouslyLinked = await productLinksForBrand(env.DB, id);
  await setBrandProducts(
    env.DB,
    id,
    productRows.map((p) => p.id),
  );

  // 品牌页、品牌索引、商品卡片品牌名与 shell（导航/计数）都可能因本次保存
  // 而改变。旧关联与新关联的商品页一并失效——商品卡展示的是「第一个」品牌，
  // 增删顺序会改变它。
  const affected = new Set([
    ...previouslyLinked.map((p) => p.public_id),
    ...productRows.map((p) => p.public_id),
  ]);
  await purgeCacheTags([
    CACHE_TAG.shell,
    ...brandCacheTags([existing.public_id]),
    ...productCacheTags(affected),
  ]);

  return back('?saved=1');
};
