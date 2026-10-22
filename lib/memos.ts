import "server-only";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Memo, MemoMeta } from "@/lib/types";

const MEMOS_DIR = path.join(process.cwd(), "content", "memos");

let cacheAll: Memo[] | null = null;

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

function loadMemos(): Memo[] {
  if (cacheAll) return cacheAll;
  if (!fs.existsSync(MEMOS_DIR)) return [];
  const files = fs.readdirSync(MEMOS_DIR).filter((file) => file.endsWith(".md"));
  const memos = files.map((file) => {
    const slug = file.slice(0, -3);
    const raw = fs.readFileSync(path.join(MEMOS_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
      : [];
    const order = typeof data.order === "number" ? data.order : -1;
    return {
      slug,
      title: asString(data.title, file, "title"),
      date: asDateString(data.date, file),
      tags,
      excerpt: asString(data.excerpt, file, "excerpt"),
      order,
      path: `/articles/${slug}`,
      content: content.trim(),
    } satisfies Memo;
  });
  memos.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.order - b.order;
  });
  cacheAll = memos;
  return memos;
}

function toMeta(memo: Memo): MemoMeta {
  const { content: _content, ...meta } = memo;
  return meta;
}

export function getAllMemos(): MemoMeta[] {
  return loadMemos().map(toMeta);
}

export function getAllMemoRecords(): Memo[] {
  return loadMemos();
}

export function getMemo(slug: string): Memo | undefined {
  return loadMemos().find((memo) => memo.slug === slug);
}

export function getMemosByTag(tag: string): MemoMeta[] {
  return getAllMemos().filter((memo) => memo.tags.includes(tag));
}

export function getMemoTags() {
  const counts = new Map<string, number>();
  for (const memo of getAllMemos()) {
    for (const tag of memo.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export function getAdjacentMemos(slug: string) {
  const memos = getAllMemos();
  const index = memos.findIndex((memo) => memo.slug === slug);
  if (index < 0) return { older: null, newer: null };
  return {
    older: memos[index + 1] ?? null,
    newer: memos[index - 1] ?? null,
  };
}
