import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EssayList } from "@/components/EssayList";
import { essayFromPost } from "@/lib/essay";
import { decodeParam } from "@/lib/params";
import { getAllTags, getPostsByTag } from "@/lib/posts";

type Props = {
  params: Promise<{ tag: string }>;
};

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag: tag.name }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = decodeParam((await params).tag);
  const title = tag;
  const description = `标签「${tag}」下的文章`;
  return {
    title,
    description,
    alternates: { canonical: `/tag/${tag}` },
    openGraph: { title, description },
  };
}

export default async function TagPage({ params }: Props) {
  const tag = decodeParam((await params).tag);
  const posts = getPostsByTag(tag);
  if (posts.length === 0) notFound();

  return (
    <main id="main">
      <div className="wrap narrow">
        <p className="crumbs">
          <Link href="/articles">文章</Link>
        </p>
        <h1 className="page-title">{tag}</h1>
        <p className="page-lede">
          标签「{tag}」下的 {posts.length} 篇文章。
        </p>
        <EssayList posts={posts.map(essayFromPost)} />
      </div>
    </main>
  );
}
