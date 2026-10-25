-- seed-hypeben-demo.sql — HYPEBEN 潮流媒体 × 电商 本地演示数据。
--
-- ⚠️ 本地演示数据（DEMO），与 seed.sql / seed-demo.sql 相互独立，仅供本地
--    `wrangler dev` 预览使用。绝不运行 db:migrate:remote / db:seed:remote，
--    不会落到任何线上数据库。每个 INSERT 都带 NOT EXISTS 守卫，重复执行幂等。
--
-- 运行方式（仅本地）：
--   npm run db:migrate              # 先建表（含 0040 内容模型）
--   wrangler d1 execute DB --local --file=./seed-hypeben-demo.sql
--
-- 内容：虚构潮流品牌、街头风格商品、中文编辑部稿件，并打通
--   商品 ↔ 品牌（product_brands）、文章 ↔ 商品（article_products）、
--   文章 ↔ 品牌（article_brands）三条关联，复现「资讯即货架」的双向链接。

-- ── 商品分类（streetwear 维度）───────────────────────────────────────────────
INSERT INTO categories (name, slug) SELECT 'Apparel','apparel'        WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug='apparel');
INSERT INTO categories (name, slug) SELECT 'Footwear','footwear'      WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug='footwear');
INSERT INTO categories (name, slug) SELECT 'Accessories','accessories' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug='accessories');

-- ── 品牌（虚构潮流品牌，本地演示用）─────────────────────────────────────────
INSERT INTO brands (name, slug, description, published)
SELECT 'NORTHWIND SUPPLY','northwind-supply','源自工装传统的户外机能支线，主打耐穿的工装夹克与多袋长裤。','1'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug='northwind-supply');

INSERT INTO brands (name, slug, description, published)
SELECT 'OCKER','ocker','以厚重棉质基础款与版画式印花著称的街头品牌。','1'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug='ocker');

INSERT INTO brands (name, slug, description, published)
SELECT 'MUTE ATHLETICS','mute-athletics','把运动科技塞进日常剪裁的技术运动品牌。','1'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug='mute-athletics');

INSERT INTO brands (name, slug, description, published)
SELECT 'TERRA FORM','terra-form','专注廓形与脚感的独立鞋履品牌。','1'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug='terra-form');

INSERT INTO brands (name, slug, description, published)
SELECT 'HAUS OBJECT','haus-object','做配饰与小型物件的器物工作室。','1'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug='haus-object');

-- ── 商品（streetswear / fashion，无图，前台走占位图）────────────────────────
INSERT INTO products (name, slug, description, price_cents, stock)
SELECT 'Box Logo 重磅 Tee','box-logo-heavyweight-tee','280g 重磅纯棉，落肩版型，本白与炭黑双色。',3900,120
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='box-logo-heavyweight-tee');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT 'Oversized 连帽卫衣','ocker-oversized-hoodie','加绒内里，重磅毛圈布，宽松不垮。',7900,80
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='ocker-oversized-hoodie');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '工装 Chore 夹克','northwind-chore-jacket','多袋工装剪裁，防泼水帆布，做旧铜扣。',13900,40
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='northwind-chore-jacket');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '技术外壳 Anorak','mute-athletics-shell-anorak','半开式风衣，三层压胶，可收纳成腰包。',17900,30
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='mute-athletics-shell-anorak');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '多袋工装长裤','northwind-cargo-pant','锥形剪裁，双侧大容量口袋，可调节裤脚。',9900,55
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='northwind-cargo-pant');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT 'Court Low 小白鞋','terra-form-court-low','低帮素面，奶油中底，做旧橡胶大底。',8900,70
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='terra-form-court-low');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT 'Trail Runner 越野跑鞋','terra-form-trail-runner','网眼鞋面，分趾抓地大底，适合通勤与轻越野。',10900,45
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='terra-form-trail-runner');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '植鞣皮卡包','haus-object-card-holder','整张植鞣皮，极简两折，会随时间变深。',2900,150
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='haus-object-card-holder');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '六片式帆布帽','haus-object-canvas-cap','硬顶六片结构，可塑形，水洗牛仔蓝。',1900,200
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='haus-object-canvas-cap');

INSERT INTO products (name, slug, description, price_cents, stock)
SELECT '织带扣腰带','northwind-webbing-belt','尼龙织带 + 快扣，户外与工装通吃。',2200,110
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='northwind-webbing-belt');

-- ── 商品 ↔ 分类 ─────────────────────────────────────────────────────────────
INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN categories c
WHERE c.slug = CASE p.slug
  WHEN 'box-logo-heavyweight-tee' THEN 'apparel'      WHEN 'ocker-oversized-hoodie' THEN 'apparel'
  WHEN 'northwind-chore-jacket' THEN 'apparel'        WHEN 'mute-athletics-shell-anorak' THEN 'apparel'
  WHEN 'northwind-cargo-pant' THEN 'apparel'
  WHEN 'terra-form-court-low' THEN 'footwear'         WHEN 'terra-form-trail-runner' THEN 'footwear'
  WHEN 'haus-object-card-holder' THEN 'accessories'   WHEN 'haus-object-canvas-cap' THEN 'accessories'
  WHEN 'northwind-webbing-belt' THEN 'accessories'
END
AND NOT EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category_id = c.id);

-- ── 商品 ↔ 品牌（一个商品可属多个品牌；position 决定卡片展示的「第一个」）─────
INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('ocker')
WHERE p.slug = 'box-logo-heavyweight-tee'
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('ocker')
WHERE p.slug = 'ocker-oversized-hoodie'
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('northwind-supply')
WHERE p.slug IN ('northwind-chore-jacket','northwind-cargo-pant','northwind-webbing-belt')
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('mute-athletics')
WHERE p.slug = 'mute-athletics-shell-anorak'
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('terra-form')
WHERE p.slug IN ('terra-form-court-low','terra-form-trail-runner')
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

INSERT INTO product_brands (product_id, brand_id, position)
SELECT p.id, b.id, 0
FROM products p JOIN brands b ON b.slug IN ('haus-object')
WHERE p.slug IN ('haus-object-card-holder','haus-object-canvas-cap')
AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.product_id = p.id AND pb.brand_id = b.id);

-- ── 文章（中文编辑部稿件；markdown 正文，发布态）────────────────────────────
INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '2026 春夏：工装复兴的三个信号',
  'workwear-revival-2026',
  '从秀场到街头，工装正以更克制的方式回来。我们总结了三个值得留意的方向。',
  '## 多袋，但更轻\n\n本季的工装不再追求「装得下整个工具箱」，而是把口袋做薄、做隐形。NORTHWIND SUPPLY 的 Chore 夹克把功能收敛成两条斜插袋，版型反而更干净。\n\n## 帆布回来了\n\n防泼水帆布取代硬挺的牛仔，成为单品的主角。它更轻，也更耐穿，适合城市通勤与短途出行。\n\n## 做旧，但不脏\n\n铜扣与缝线的「养」被前置到工艺里——出厂即是成品，不需要你再去磨。',
  'HYPEBEN 编辑部', 'fashion', 1, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='workwear-revival-2026');

INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '联名降温？我们盘了盘今年的合作逻辑',
  'collab-cooldown-2026',
  '联名没死，只是变得更讲究。从数量到叙事，品牌们正在重新计算合作的性价比。',
  '## 联名从「出圈」到「深耕」\n\n过去一年，高频联名带来的疲劳感肉眼可见。取而代之的是与单一匠人、单一工坊的长线合作。\n\n## 叙事先行\n\n消费者不再为 logo 叠 logo 买单，能为产品讲清一个来由的合作才站得住。\n\n## 量更小，价更稳\n\n小批量、不限量（或准限量）正在替代「秒罄」的饥饿游戏。',
  'HYPEBEN 编辑部', 'new-arrivals', 1, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='collab-cooldown-2026');

INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '球鞋二级市场一年观察',
  'sneaker-resale-2026',
  '价格回归理性，但真正的好鞋依然抢手。我们看了过去十二个月的数据。',
  '## 溢价收窄\n\n热门款的首发溢价普遍回落，炒卖空间被压缩，反而利好真正想穿的人。\n\n## 复古跑鞋续航\n\n分趾大底与薄底复古跑鞋的热度没有退，舒适与脚感成了硬指标。\n\n## 小众品牌抬头\n\n独立鞋履品牌靠脚感与廓形抢下了一块原本属于大厂的市场。',
  'HYPEBEN 编辑部', 'sneakers', 0, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='sneaker-resale-2026');

INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '城市通勤的极简穿搭公式',
  'minimal-commute-fit',
  '三件单品，一套能穿整周的都市通勤方案。',
  '## 一件重磅 Tee 打底\n\n280g 以上的重磅棉 Tee 不塌、不透，单穿或叠穿都稳。\n\n## 一条锥形工装裤\n\n多袋但不臃肿，坐下不勒，走起路来有型。\n\n## 一双素面小白鞋\n\n低帮素面，配什么都干净。\n\n把这三件买对，一周五天不用想。',
  'HYPEBEN 编辑部', 'lifestyle', 1, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='minimal-commute-fit');

INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '为什么一件重磅 Tee 值得反复买',
  'why-heavyweight-tee',
  '基础款的价值不在潮，而在耐穿。聊聊重磅棉 Tee 的工艺门槛。',
  '## 克重决定骨架\n\n低于 200g 的 Tee 容易透、容易塌；280g 以上才撑得起落肩版型。\n\n## 版型比印花重要\n\n印花会过时，落肩与领口工艺不会。\n\n## 颜色留白\n\n本白与炭黑是永远不会错的两色。',
  'HYPEBEN 编辑部', 'fashion', 0, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='why-heavyweight-tee');

INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  'Techno 与运动装的隐秘血缘',
  'techno-sportswear',
  '从地下俱乐部到跑步道，运动装与电子音乐的审美一直互相喂养。',
  '## 黑色是通用语\n\n无论是凌晨的舞池还是清晨的跑道，全黑机能装都是默认皮肤。\n\n## 反光即态度\n\n反光条最早为安全而生，后来成了夜生活的身份标识。\n\n## 功能先于装饰\n\n两条场景都只留真正有用的细节。',
  'HYPEBEN 编辑部', 'music', 0, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='techno-sportswear');

-- 一篇草稿：后台可见、前台不发布（验证 published=0 的行为）。
INSERT INTO articles (title, slug, excerpt, body_markdown, author, category, featured, published, published_at)
SELECT
  '（草稿）下季趋势早知道',
  'next-season-draft',
  '这是一篇还没写完的草稿，仅后台可见。',
  '## 待补充\n\n本篇还在整理中。',
  'HYPEBEN 编辑部', 'fashion', 0, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug='next-season-draft');

-- ── 文章 ↔ 商品（文章详情页「Shop this story」；商品详情页「相关报道」）──────
INSERT INTO article_products (article_id, product_id, position)
SELECT a.id, p.id, 0
FROM articles a JOIN products p
WHERE a.slug = 'workwear-revival-2026' AND p.slug IN ('northwind-chore-jacket','northwind-cargo-pant')
AND NOT EXISTS (SELECT 1 FROM article_products ap WHERE ap.article_id = a.id AND ap.product_id = p.id);

INSERT INTO article_products (article_id, product_id, position)
SELECT a.id, p.id, 0
FROM articles a JOIN products p
WHERE a.slug = 'minimal-commute-fit' AND p.slug IN ('box-logo-heavyweight-tee','northwind-cargo-pant','terra-form-court-low')
AND NOT EXISTS (SELECT 1 FROM article_products ap WHERE ap.article_id = a.id AND ap.product_id = p.id);

INSERT INTO article_products (article_id, product_id, position)
SELECT a.id, p.id, 0
FROM articles a JOIN products p
WHERE a.slug = 'why-heavyweight-tee' AND p.slug IN ('box-logo-heavyweight-tee','ocker-oversized-hoodie')
AND NOT EXISTS (SELECT 1 FROM article_products ap WHERE ap.article_id = a.id AND ap.product_id = p.id);

INSERT INTO article_products (article_id, product_id, position)
SELECT a.id, p.id, 0
FROM articles a JOIN products p
WHERE a.slug = 'sneaker-resale-2026' AND p.slug IN ('terra-form-court-low','terra-form-trail-runner')
AND NOT EXISTS (SELECT 1 FROM article_products ap WHERE ap.article_id = a.id AND ap.product_id = p.id);

INSERT INTO article_products (article_id, product_id, position)
SELECT a.id, p.id, 0
FROM articles a JOIN products p
WHERE a.slug = 'techno-sportswear' AND p.slug IN ('mute-athletics-shell-anorak','terra-form-trail-runner')
AND NOT EXISTS (SELECT 1 FROM article_products ap WHERE ap.article_id = a.id AND ap.product_id = p.id);

-- ── 文章 ↔ 品牌（文章相关品牌；品牌页「相关报道」）──────────────────────────
INSERT INTO article_brands (article_id, brand_id)
SELECT a.id, b.id
FROM articles a JOIN brands b ON b.slug IN ('northwind-supply')
WHERE a.slug = 'workwear-revival-2026'
AND NOT EXISTS (SELECT 1 FROM article_brands ab WHERE ab.article_id = a.id AND ab.brand_id = b.id);

INSERT INTO article_brands (article_id, brand_id)
SELECT a.id, b.id
FROM articles a JOIN brands b ON b.slug IN ('ocker','northwind-supply','terra-form')
WHERE a.slug = 'minimal-commute-fit'
AND NOT EXISTS (SELECT 1 FROM article_brands ab WHERE ab.article_id = a.id AND ab.brand_id = b.id);

INSERT INTO article_brands (article_id, brand_id)
SELECT a.id, b.id
FROM articles a JOIN brands b ON b.slug IN ('terra-form')
WHERE a.slug = 'sneaker-resale-2026'
AND NOT EXISTS (SELECT 1 FROM article_brands ab WHERE ab.article_id = a.id AND ab.brand_id = b.id);

INSERT INTO article_brands (article_id, brand_id)
SELECT a.id, b.id
FROM articles a JOIN brands b ON b.slug IN ('mute-athletics','terra-form')
WHERE a.slug = 'techno-sportswear'
AND NOT EXISTS (SELECT 1 FROM article_brands ab WHERE ab.article_id = a.id AND ab.brand_id = b.id);

-- ── 公共 ID 补齐（与迁移 0040 同手法：hex 为 Crockford base32 子集）─────────
-- 仅补本文件新增行（WHERE public_id IS NULL），不覆盖既有值。
UPDATE brands    SET public_id = 'brnd_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE articles  SET public_id = 'art_'  || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE products  SET public_id = 'prod_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE product_variants SET public_id = 'var_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE product_extras   SET public_id = 'xtra_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE product_images   SET public_id = 'pimg_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE categories       SET public_id = 'cat_'  || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
