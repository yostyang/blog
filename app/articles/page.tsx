import type { Metadata } from "next";
import { EssayList } from "@/components/EssayList";
import { TagFilters } from "@/components/TagFilters";
import { getArticleIndex, getMemoIndex } from "@/lib/catalog";
import { essayFromPost } from "@/lib/essay";
import { getAllTags } from "@/lib/posts";

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
      description: "公众号和少数派里写过的长文，按发布时间倒序。",
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
  const posts = getArticleIndex();
  const visible = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;
  const memos = getMemoIndex();
  return (
    <main id="main">
      <div className="wrap narrow">
        <h1 className="page-title">{tag ? `「${tag}」` : "文章"}</h1>
        <p className="page-lede">
          {tag
            ? `${visible.length} 篇文章带有这个话题。`
            : `公众号和少数派里写过的长文，按发布时间倒序，共 ${posts.length} 篇。每天的产业观察放在备忘录（${memos.length} 天）。`}
        </p>
        <TagFilters tags={getAllTags()} active={tag || undefined} base="/articles" total={posts.length} />
        <EssayList posts={visible.map(essayFromPost)} />
      </div>
    </main>
  );
}
