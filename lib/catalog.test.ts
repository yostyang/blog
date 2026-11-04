import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import { getArticleIndex, getMemoIndex, homeArticleCountText } from "./catalog.ts";
import { getAllMemos } from "./memos.ts";
import { getAllPosts, isOmittedPost } from "./posts.ts";
import { siteVersion } from "./version.ts";

const root = path.join(import.meta.dirname, "..");

test("draft, hidden, duplicate, and redirect sources are omitted; featured is not", () => {
  const redirects = new Set(["/posts/old"]);
  assert.equal(isOmittedPost({}, "/posts/new", redirects), false);
  assert.equal(isOmittedPost({ featured: true }, "/articles/kept", redirects), false);
  assert.equal(isOmittedPost({ draft: false, hidden: false, duplicate: false }, "/posts/new", redirects), false);
  assert.equal(isOmittedPost({ draft: true, featured: true }, "/articles/draft", redirects), true);
  assert.equal(isOmittedPost({ hidden: true }, "/posts/hidden", redirects), true);
  assert.equal(isOmittedPost({ duplicate: true }, "/posts/copy", redirects), true);
  assert.equal(isOmittedPost({}, "/posts/old", redirects), true);
  assert.equal(isOmittedPost({ draft: "true" }, "/posts/new", redirects), false);
});

test("the article index lists each public post once", () => {
  const expected = publicPosts();
  const index = getArticleIndex();
  const indexSlugs = index.map((post) => post.slug);
  const indexPaths = index.map((post) => post.path);

  assert.deepEqual(repeated(indexSlugs), [], "article index has duplicate slugs");
  assert.deepEqual(repeated(indexPaths), [], "article index has duplicate paths");
  assert.deepEqual(repeated(expected.map((post) => post.slug)), []);
  assert.deepEqual(repeated(expected.map((post) => post.path)), [], "public posts share a path");
  assert.equal(
    index.length,
    expected.length,
    `article index lists ${index.length}, public posts are ${expected.length}`,
  );

  const bySlug = new Map(index.map((post) => [post.slug, post]));
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const post of expected) {
    const listed = bySlug.get(post.slug);
    if (!listed) {
      missing.push(post.slug);
      continue;
    }
    if (listed.path !== post.path || listed.date !== post.date || listed.title !== post.title) {
      wrong.push(post.slug);
    }
  }
  assert.deepEqual(missing, []);
  assert.deepEqual(wrong, []);
  assert.deepEqual(
    getAllPosts().map((post) => post.slug),
    indexSlugs,
    "getAllPosts drifted from the article index",
  );

  for (const prefix of ["sspai-", "wechat-"]) {
    const wanted = expected.filter((post) => post.slug.startsWith(prefix)).map((post) => post.slug).sort();
    const listed = indexSlugs.filter((slug) => slug.startsWith(prefix)).sort();
    assert.ok(wanted.length > 0, `content/posts has no ${prefix} file outside the exclusions`);
    assert.deepEqual(listed, wanted, `${prefix} posts missing from /articles`);
  }
});

test("home 「全部 N 篇文章」 uses the article index", () => {
  const count = publicPosts().length;
  assert.equal(homeArticleCountText(), `全部 ${count} 篇文章`);
  assert.equal(getArticleIndex().length, count);

  const home = read("app/page.tsx");
  const articles = read("app/articles/page.tsx");
  const categories = read("components/ArticleIndex.tsx");
  assert.match(home, /\{homeArticleCountText\(\)\}/);
  assert.doesNotMatch(home, /全部 \{/);
  assert.match(articles, /const posts = getArticleIndex\(\)/);
  assert.doesNotMatch(articles, /getFeaturedPosts/);
  assert.match(articles, /共 \$\{posts\.length\} 篇。每天的产业观察放在备忘录（\$\{memos\.length\} 天）/);
  assert.match(categories, /const all = getArticleIndex\(\)/);
});

test("the memo index lists every memo file once, with unique dates", () => {
  const expected = memoFiles();
  const index = getMemoIndex();
  const dates = expected.map((memo) => memo.date);

  assert.equal(index.length, expected.length, `/memo lists ${index.length}, content/memos has ${expected.length} files`);
  assert.deepEqual(repeated(index.map((memo) => memo.slug)), []);
  assert.deepEqual(repeated(index.map((memo) => memo.path)), []);
  assert.deepEqual(repeated(dates), [], `memo dates repeat: ${repeated(dates).join(", ")}`);
  assert.deepEqual(
    index.map((memo) => memo.slug).sort(),
    expected.map((memo) => memo.slug).sort(),
  );

  const bySlug = new Map(index.map((memo) => [memo.slug, memo]));
  for (const memo of expected) {
    const listed = bySlug.get(memo.slug);
    assert.ok(listed, memo.slug);
    assert.equal(listed.date, memo.date);
    assert.equal(listed.title, memo.title);
    assert.equal(listed.path, memo.path);
  }
  assert.deepEqual(
    getAllMemos().map((memo) => memo.slug),
    index.map((memo) => memo.slug),
  );

  const memoSlugs = expected.filter((memo) => memo.slug.startsWith("memo-")).map((memo) => memo.slug);
  assert.ok(memoSlugs.length > 0, "content/memos has no memo- file");
  assert.equal(memoSlugs.length, expected.length, "content/memos has a file that does not start with memo-");
  assert.deepEqual(
    index.map((memo) => memo.slug).filter((slug) => slug.startsWith("memo-")).sort(),
    memoSlugs.sort(),
  );

  const memoPage = read("app/memo/page.tsx");
  assert.match(memoPage, /const all = getMemoIndex\(\)/);
});

test("post and memo routes are unique, and every file has a date and title", () => {
  const posts = publicPosts();
  const memos = memoFiles();
  const routes = [...posts.map((post) => post.path), ...memos.map((memo) => memo.path)];
  assert.deepEqual(repeated(routes), [], `routes repeat: ${repeated(routes).join(", ")}`);

  const listedRoutes = [...getArticleIndex().map((post) => post.path), ...getMemoIndex().map((memo) => memo.path)];
  assert.deepEqual(repeated(listedRoutes), []);
  assert.deepEqual(listedRoutes.slice().sort(), routes.slice().sort());
});

test("the footer shows the package version", () => {
  const packageJson = JSON.parse(read("package.json")) as { version: string };
  assert.equal(siteVersion, packageJson.version);
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(read("app/layout.tsx"), /v\{siteVersion\}/);
});

type Row = { slug: string; title: string; date: string; path: string };

function publicPosts(): Row[] {
  const redirects = new Set(
    Object.keys(JSON.parse(read("content/redirects.json")) as Record<string, string>),
  );
  const dir = path.join(root, "content", "posts");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .flatMap((file) => {
      const slug = file.slice(0, -3);
      const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      const title = requireTitle(data.title, file);
      const date = requireDate(data.date, file);
      const route = postPath(slug, data);
      if (data.draft === true || data.hidden === true || data.duplicate === true || redirects.has(route)) {
        return [];
      }
      return [{ slug, title, date, path: route }];
    });
}

function memoFiles(): Row[] {
  const dir = path.join(root, "content", "memos");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const slug = file.slice(0, -3);
      const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      return {
        slug,
        title: requireTitle(data.title, file),
        date: requireDate(data.date, file),
        path: `/articles/${slug}`,
      };
    });
}

function postPath(slug: string, data: Record<string, unknown>) {
  const alias = typeof data.alias === "string" && data.alias.trim() ? data.alias.trim() : null;
  return data.featured === true ? `/articles/${alias || slug}` : `/posts/${slug}`;
}

function requireTitle(value: unknown, file: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${file} 缺少 title`);
  return value.trim();
}

function requireDate(value: unknown, file: string) {
  let text = "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    text = `${year}-${month}-${day}`;
  } else if (typeof value === "string") {
    text = value.trim();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${file} 的 date 需要是 YYYY-MM-DD`);
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${file} 的 date ${text} 不是有效日期`);
  }
  return text;
}

function repeated(values: string[]) {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const value of values) {
    if (seen.has(value)) dupes.push(value);
    else seen.add(value);
  }
  return dupes;
}

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
