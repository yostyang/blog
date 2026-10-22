import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { tagHref } from "@/lib/essay";
import { extractHeadings } from "@/lib/headings";
import { readingMinutes } from "@/lib/format";
import { decodeParam } from "@/lib/params";
import { getAdjacent, getAllPosts, getPost } from "@/lib/posts";
import { getSiteUrl, site } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const post = getPost(slug);
  if (!post) return { title: "未找到文章" };
  const images = post.cover ? [{ url: post.cover, alt: post.title }] : undefined;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: post.path },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      authors: [site.author],
      tags: post.tags,
      images,
    },
    twitter: {
      card: post.cover ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const slug = decodeParam((await params).slug);
  const post = getPost(slug);
  if (!post) notFound();
  const { older, newer } = getAdjacent(post.slug);
  const headings = extractHeadings(post.content);
  const minutes = readingMinutes(post.content);
  const url = `${getSiteUrl()}${post.path}`;
  const base = post.featured ? "/articles" : "/tag";
  const crumbs = post.featured
    ? [{ href: "/articles", label: "文章" }]
    : [
        { href: "/articles", label: "文章" },
        { href: `/category/${post.category}`, label: post.category },
      ];

  return (
    <ArticleView
      title={post.title}
      date={post.date}
      tags={post.tags.map((name) => ({ name, href: tagHref(base, name) }))}
      content={post.content}
      headings={headings}
      minutes={minutes}
      crumbs={crumbs}
      older={older ? { href: older.path, title: older.title } : null}
      newer={newer ? { href: newer.path, title: newer.title } : null}
      olderLabel="上一篇"
      newerLabel="下一篇"
      pagerLabel="相邻文章"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.date,
        dateModified: post.date,
        description: post.excerpt,
        inLanguage: "zh-CN",
        articleSection: post.category,
        keywords: post.tags.join(","),
        image: post.cover ? new URL(post.cover, getSiteUrl()).toString() : undefined,
        author: { "@type": "Person", name: site.author },
        publisher: { "@type": "Person", name: site.author },
        mainEntityOfPage: url,
      }}
    />
  );
}
