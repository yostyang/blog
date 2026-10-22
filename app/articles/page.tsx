import type { Metadata } from "next";
import { EssayList } from "@/components/EssayList";
import { TagFilters } from "@/components/TagFilters";
import { essayFromPost } from "@/lib/essay";
import { getAllMemos } from "@/lib/memos";
import { getFeaturedPosts, getFeaturedTags } from "@/lib/posts";

type Props = {
  searchParams: Promise<{ tag?: string | string[] }>;
};

function oneTag(value: string | string[] | undefined) {
  const tag = Array.isArray(value) ? value[0] : value;
  return tag?.trim() || "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const tag = oneTag((await searchParams).tag);
  if (!tag) {
    return {
      title: "文章",
      description: "公众号里写过的长文，按发布时间倒序。",
      alternates: { canonical: "/articles" },
    };
  }
  return {
    title: `「${tag}」相关文章`,
    description: `带有话题「${tag}」的文章。`,
    alternates: { canonical: "/articles" },
  };
}

export default async function ArticlesPage({ searchParams }: Props) {
  const tag = oneTag((await searchParams).tag);
  const posts = getFeaturedPosts();
  const visible = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;
  const memos = getAllMemos();
  return (
    <main id="main">
      <div className="wrap narrow">
        <h1 className="page-title">{tag ? `「${tag}」` : "文章"}</h1>
        <p className="page-lede">
          {tag
            ? `${visible.length} 篇文章带有这个话题。`
            : `公众号里写过的长文，按发布时间倒序。每天的产业观察单独放在备忘录，共 ${memos.length} 篇。`}
        </p>
        <TagFilters tags={getFeaturedTags()} active={tag || undefined} base="/articles" total={posts.length} />
        <EssayList posts={visible.map(essayFromPost)} />
      </div>
    </main>
  );
}
