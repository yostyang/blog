import "server-only";
import { getAllMemos } from "@/lib/memos";
import { getAllPosts } from "@/lib/posts";
import type { MemoMeta, PostMeta } from "@/lib/types";

/** Public posts listed on /articles, one per kept file.
 *  Home 「全部 N 篇文章」 uses this same list. `featured` only fills the homepage row. */
export function getArticleIndex(): PostMeta[] {
  return getAllPosts();
}

/** Memos listed on /memo, one per file in content/memos. */
export function getMemoIndex(): MemoMeta[] {
  return getAllMemos();
}
