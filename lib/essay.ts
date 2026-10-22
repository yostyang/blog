import { plainText } from "@/lib/plain";
import type { EssayListItem, Memo, MemoMeta, Post, PostMeta } from "@/lib/types";

export function tagHref(base: "/articles" | "/memo" | "/tag", name: string) {
  if (base === "/tag") return `/tag/${encodeURIComponent(name)}`;
  return `${base}?tag=${encodeURIComponent(name)}`;
}

export function essayFromPost(post: PostMeta): EssayListItem {
  const base = post.featured ? "/articles" : "/tag";
  return {
    key: post.path,
    href: post.path,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt,
    thumb: post.thumb,
    tags: post.tags.map((name) => ({ name, href: tagHref(base, name) })),
  };
}

export function essayFromMemo(memo: MemoMeta): EssayListItem {
  return {
    key: memo.path,
    href: memo.path,
    title: memo.title,
    date: memo.date,
    excerpt: memo.excerpt,
    thumb: null,
    tags: memo.tags.map((name) => ({ name, href: tagHref("/memo", name) })),
  };
}

export type SearchDoc = EssayListItem & { haystack: string };

export function searchDocFromPost(post: Post): SearchDoc {
  const item = essayFromPost(post);
  return {
    ...item,
    haystack: [post.title, post.excerpt, post.category, post.tags.join(" "), plainText(post.content)]
      .join("\n")
      .toLowerCase(),
  };
}

export function searchDocFromMemo(memo: Memo): SearchDoc {
  const item = essayFromMemo(memo);
  return {
    ...item,
    haystack: [memo.title, memo.excerpt, memo.tags.join(" "), plainText(memo.content)].join("\n").toLowerCase(),
  };
}
