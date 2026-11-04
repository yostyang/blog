import "server-only";
import { getAllMemos } from "@/lib/memos";
import { getAllPosts } from "@/lib/posts";

/** Posts listed on `/articles`, in list order. `featured` does not filter this. */
export function getArticleIndex() {
  return getAllPosts();
}

/** Home-page link text. The number is the `/articles` index, not the memo count. */
export function homeArticleCountText() {
  return `全部 ${getArticleIndex().length} 篇文章`;
}

/** Days listed on `/memo`, one entry per file in `content/memos`. */
export function getMemoIndex() {
  return getAllMemos();
}
