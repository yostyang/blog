import type { Metadata } from "next";
import { SearchScreen } from "@/components/SearchScreen";
import { searchDocFromMemo, searchDocFromPost } from "@/lib/essay";
import { getAllMemoRecords } from "@/lib/memos";
import { getAllPostRecords } from "@/lib/posts";

export const metadata: Metadata = {
  title: "搜索",
  description: "按标题、摘要、标签或正文查找文章和备忘录。",
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  const docs = [...getAllPostRecords().map(searchDocFromPost), ...getAllMemoRecords().map(searchDocFromMemo)].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
  );
  return <SearchScreen docs={docs} />;
}
