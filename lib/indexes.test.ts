import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { getArticleIndex, getMemoIndex } from "./indexes.ts";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

assert.equal(process.cwd(), root, "run npm test from the repository root");

type Row = { slug: string; path: string; title: string; date: string };

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function markdownFiles(dir: string) {
  return fs.readdirSync(path.join(root, dir)).filter((file) => file.endsWith(".md"));
}

/** Same acceptance rule as the loaders: a real YYYY-MM-DD, including YAML dates. */
function asDateString(value: unknown, file: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`${file} 的 date 需要是 YYYY-MM-DD`);
}

function asTitle(value: unknown, file: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${file} 缺少标题`);
  return value.trim();
}

function optionalPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function redirectSources() {
  try {
    const raw = JSON.parse(read("content/redirects.json")) as Record<string, string>;
    return new Set(Object.keys(raw));
  } catch {
    return new Set<string>();
  }
}

/** Drafts, hidden posts, flagged duplicates, and redirect sources are not public. `featured` is not an exclusion.
 *  Kept independent of lib/posts.ts so a change there cannot hide a missing post. */
function isOmitted(data: Record<string, unknown>, publicPath: string, redirects: Set<string>) {
  if (data.draft === true || data.hidden === true || data.duplicate === true) return true;
  return redirects.has(publicPath);
}

function publicPostPath(slug: string, data: Record<string, unknown>) {
  const alias = optionalPath(data.alias);
  return data.featured === true ? `/articles/${alias || slug}` : `/posts/${slug}`;
}

function publicPosts(): Row[] {
  const redirects = redirectSources();
  const rows: Row[] = [];
  for (const file of markdownFiles("content/posts")) {
    const slug = file.slice(0, -3);
    const { data } = matter(read(path.join("content/posts", file)));
    const route = publicPostPath(slug, data);
    if (isOmitted(data, route, redirects)) continue;
    rows.push({
      slug,
      path: route,
      title: asTitle(data.title, file),
      date: asDateString(data.date, file),
    });
  }
  return rows;
}

function memoFiles(): Row[] {
  return markdownFiles("content/memos").map((file) => {
    const slug = file.slice(0, -3);
    const { data } = matter(read(path.join("content/memos", file)));
    return {
      slug,
      path: `/articles/${slug}`,
      title: asTitle(data.title, file),
      date: asDateString(data.date, file),
    };
  });
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function assertSameRows(actual: Row[], expected: Row[], label: string) {
  const actualSlugs = actual.map((row) => row.slug);
  const expectedSlugs = expected.map((row) => row.slug);
  assert.deepEqual(duplicates(actualSlugs), [], `${label} has duplicate slugs`);
  assert.deepEqual(duplicates(actual.map((row) => row.path)), [], `${label} has duplicate paths`);
  const actualSet = new Set(actualSlugs);
  const expectedSet = new Set(expectedSlugs);
  const missing = expectedSlugs.filter((slug) => !actualSet.has(slug));
  const extra = actualSlugs.filter((slug) => !expectedSet.has(slug));
  assert.deepEqual(missing, [], `${label} missing: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `${label} unexpected: ${extra.join(", ")}`);
  assert.equal(actual.length, expected.length, `${label} count`);
  const bySlug = new Map(actual.map((row) => [row.slug, row]));
  for (const row of expected) {
    assert.deepEqual(bySlug.get(row.slug), row, `${label} ${row.slug}`);
  }
}

function assertValidDate(date: string, label: string) {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/, label);
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  assert.equal(utc.getUTCFullYear(), year, label);
  assert.equal(utc.getUTCMonth() + 1, month, label);
  assert.equal(utc.getUTCDate(), day, label);
}

test("article index lists each public post once", () => {
  const expected = publicPosts();
  const index = getArticleIndex().map((post) => ({
    slug: post.slug,
    path: post.path,
    title: post.title,
    date: post.date,
  }));
  assertSameRows(index, expected, "/articles");
  assert.ok(expected.length > 0);

  const articles = read("app/articles/page.tsx");
  assert.match(articles, /const posts = getArticleIndex\(\)/);
  assert.match(articles, /const visible = tag \? posts\.filter\(\(post\) => post\.tags\.includes\(tag\)\) : posts/);
  assert.match(articles, /<EssayList posts=\{visible\.map\(essayFromPost\)\} \/>/);
  assert.match(articles, /共 \$\{posts\.length\} 篇/);
  assert.doesNotMatch(articles, /共 \$\{memos\.length\} 篇/);
  assert.doesNotMatch(articles, /getFeaturedPosts|getAllPosts/);
  assert.match(read("components/ArticleIndex.tsx"), /const all = getArticleIndex\(\)/);
});

test("home 「全部 N 篇文章」 uses the article index", () => {
  const total = publicPosts().length;
  assert.equal(getArticleIndex().length, total);
  const home = read("app/page.tsx");
  assert.match(home, /全部 \{getArticleIndex\(\)\.length\} 篇文章/);
  assert.doesNotMatch(home, /全部 \{(?:posts|picks|memos|getFeaturedPosts\(\)|getAllMemos\(\))\.length\}/);
});

test("memo index lists each file once and dates are unique", () => {
  const expected = memoFiles();
  const index = getMemoIndex().map((memo) => ({
    slug: memo.slug,
    path: memo.path,
    title: memo.title,
    date: memo.date,
  }));
  assertSameRows(index, expected, "/memo");
  assert.equal(index.length, markdownFiles("content/memos").length);
  assert.deepEqual(duplicates(index.map((memo) => memo.date)), [], "duplicate memo dates");

  const memoPage = read("app/memo/page.tsx");
  assert.match(memoPage, /const all = getMemoIndex\(\)/);
  assert.match(memoPage, /const visible = tag \? all\.filter\(\(memo\) => memo\.tags\.includes\(tag\)\) : all/);
  assert.match(memoPage, /已经记了 \$\{all\.length\} 天/);
  assert.match(memoPage, /<LedgerList memos=\{list\} \/>/);
  assert.doesNotMatch(memoPage, /getAllMemos\(/);
});

test("every post and memo has a title, a real date, and a unique route", () => {
  const posts = getArticleIndex();
  const memos = getMemoIndex();
  for (const post of posts) {
    assert.ok(post.title.trim(), post.slug);
    assert.equal(post.title, post.title.trim(), post.slug);
    assertValidDate(post.date, post.slug);
    const alias = post.alias?.trim() || post.slug;
    const route = post.featured ? `/articles/${alias}` : `/posts/${post.slug}`;
    assert.equal(post.path, route, post.slug);
  }
  for (const memo of memos) {
    assert.ok(memo.title.trim(), memo.slug);
    assert.equal(memo.title, memo.title.trim(), memo.slug);
    assertValidDate(memo.date, memo.slug);
    assert.equal(memo.path, `/articles/${memo.slug}`, memo.slug);
  }
  const routes = [...posts.map((post) => post.path), ...memos.map((memo) => memo.path)];
  assert.deepEqual(duplicates(routes), [], `duplicate routes: ${duplicates(routes).join(", ")}`);

  const postSlugs = new Set(posts.map((post) => post.slug));
  const memoSlugs = new Set(memos.map((memo) => memo.slug));
  for (const prefix of ["sspai-", "wechat-"] as const) {
    const files = markdownFiles("content/posts").filter((file) => file.startsWith(prefix));
    assert.ok(files.length > 0, prefix);
    for (const file of files) {
      const slug = file.slice(0, -3);
      assert.ok(postSlugs.has(slug), `${file} is missing from the article index`);
    }
  }
  const memoFilesNamed = markdownFiles("content/memos").filter((file) => file.startsWith("memo-"));
  assert.ok(memoFilesNamed.length > 0);
  assert.equal(memoFilesNamed.length, memos.length);
  for (const file of memoFilesNamed) {
    assert.ok(memoSlugs.has(file.slice(0, -3)), `${file} is missing from the memo index`);
  }
});
