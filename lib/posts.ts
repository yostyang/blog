import "server-only";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { isCategory } from "@/lib/categories";
import type { Post, PostMeta } from "@/lib/types";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

let cacheAll: Post[] | null = null;

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

function asString(value: unknown, file: string, key: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${file} 缺少 frontmatter 字段 ${key}`);
  }
  return value.trim();
}

function asOptionalPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function loadPosts(): Post[] {
  if (cacheAll) return cacheAll;
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"));

  const posts = files.map((file) => {
    const slug = file.slice(0, -3);
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const category = asString(data.category, file, "category");
    if (!isCategory(category)) {
      throw new Error(`${file} 的分类「${category}」不在四个专题里`);
    }
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
      : [];
    const order = typeof data.order === "number" ? data.order : -1;
    return {
      slug,
      title: asString(data.title, file, "title"),
      date: asDateString(data.date, file),
      category,
      tags,
      excerpt: asString(data.excerpt, file, "excerpt"),
      thumb: asOptionalPath(data.thumb),
      cover: asOptionalPath(data.cover),
      order,
      content: content.trim(),
    } satisfies Post;
  });

  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.order - b.order;
  });

  cacheAll = posts;
  return posts;
}

function toMeta(post: Post): PostMeta {
  const { content: _content, ...meta } = post;
  return meta;
}

export function getAllPosts(): PostMeta[] {
  return loadPosts().map(toMeta);
}

export function getPost(slug: string): Post | undefined {
  return loadPosts().find((post) => post.slug === slug);
}

export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter((post) => post.category === category);
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}

export function getAllTags() {
  const counts = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"));
}

export function getAdjacent(slug: string) {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index < 0) return { older: null, newer: null };
  return {
    older: posts[index + 1] ?? null,
    newer: posts[index - 1] ?? null,
  };
}
