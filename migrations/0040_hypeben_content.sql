-- 0040: HYPEBEN 潮流媒体内容模型 — 文章（articles）与品牌（brands）。
-- Additive；不修改既有迁移。编号接 0039（注意仓库中已有两个 0033_*，
-- 按完整文件名跟踪，无冲突）。
--
-- 设计原则：
--   • 文章复用 pages 的成熟模式：slug UNIQUE、published 草稿态、markdown 正文
--     （html:false 安全渲染）、媒体关联表（article_media）、updated_at 应用维护。
--   • 关联一律用 M2M 关系表（article_products / article_brands / product_brands），
--     不引入外键强约束（D1 不强制执行 FK，清理显式做），不引入任何搜索服务。
--   • public_id 前缀：article=art_，brand=brnd_（见 features/ids/publicId.ts）。
--   • published_at 仅发布时写入，列表按发布时间倒序。

CREATE TABLE IF NOT EXISTS brands (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  slug            TEXT    NOT NULL UNIQUE,
  description     TEXT    NOT NULL DEFAULT '',
  -- R2 对象键（media.image_key 语义：只记键，不拥有文件）
  logo_image_key  TEXT,
  published       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  public_id       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS brands_public_id
  ON brands (public_id);

CREATE INDEX IF NOT EXISTS brands_published_name
  ON brands (published, name COLLATE NOCASE);

-- 商品 ↔ 品牌（M2M）。一个商品可属多个品牌（联名），一个品牌有多商品。
CREATE TABLE IF NOT EXISTS product_brands (
  product_id  INTEGER NOT NULL REFERENCES products(id),
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, brand_id)
);

CREATE INDEX IF NOT EXISTS product_brands_brand
  ON product_brands (brand_id, product_id);

CREATE TABLE IF NOT EXISTS articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  slug            TEXT    NOT NULL UNIQUE,
  excerpt         TEXT    NOT NULL DEFAULT '',
  body_markdown   TEXT    NOT NULL DEFAULT '',
  -- R2 对象键：文章封面图（同样只记键）
  cover_image_key TEXT,
  author          TEXT    NOT NULL DEFAULT '',
  -- 封闭频道集合，见 features/articles/taxonomy.ts
  category        TEXT    NOT NULL DEFAULT 'fashion',
  -- 编辑精选：首页大图与精选区取 featured=1 且已发布
  featured        INTEGER NOT NULL DEFAULT 0,
  published       INTEGER NOT NULL DEFAULT 0,
  published_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  public_id       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS articles_public_id
  ON articles (public_id);

CREATE INDEX IF NOT EXISTS articles_published_feed
  ON articles (published, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS articles_category_feed
  ON articles (category, published, published_at DESC, id DESC);

-- 文章正文引用的媒体（与 page_media 同模式：每次保存从正文重建）。
CREATE TABLE IF NOT EXISTS article_media (
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  media_id    INTEGER NOT NULL REFERENCES media(id),
  PRIMARY KEY (article_id, media_id)
);

CREATE INDEX IF NOT EXISTS article_media_media
  ON article_media (media_id, article_id);

-- 文章 ↔ 商品：文章详情页「Shop this story」，商品详情页「相关报道」。
CREATE TABLE IF NOT EXISTS article_products (
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, product_id)
);

CREATE INDEX IF NOT EXISTS article_products_product
  ON article_products (product_id, article_id);

-- 文章 ↔ 品牌：文章的相关品牌，品牌页的相关报道。
CREATE TABLE IF NOT EXISTS article_brands (
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  PRIMARY KEY (article_id, brand_id)
);

CREATE INDEX IF NOT EXISTS article_brands_brand
  ON article_brands (brand_id, article_id);

-- 既有行补齐 public_id（与 0033_public_ids.sql 同手法：hex 是 Crockford
-- base32 的子集，10 位 hex 即合法 token）。新行进库时由 withPublicId 生成。
UPDATE articles SET public_id = 'art_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
UPDATE brands   SET public_id = 'brnd_' || lower(substr(hex(randomblob(10)),1,10)) WHERE public_id IS NULL;
