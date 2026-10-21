import type { Metadata } from "next";
import { SearchScreen } from "@/components/SearchScreen";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "搜索",
  description: "按标题、摘要、专题或标签查找文章。",
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  return <SearchScreen posts={getAllPosts()} />;
}
