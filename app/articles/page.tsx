import type { Metadata } from "next";
import { ArticleIndex } from "@/components/ArticleIndex";
import { getAllPosts } from "@/lib/posts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "文章",
  description: `${site.name}的全部文章，按发布时间倒序。`,
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  const posts = getAllPosts();
  return (
    <ArticleIndex
      posts={posts}
      title="文章"
      lede={`全部 ${posts.length} 篇，按发布时间倒序。四个专题可以在这里切换。`}
      active="all"
    />
  );
}
