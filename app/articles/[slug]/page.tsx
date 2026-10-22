import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { tagHref } from "@/lib/essay";
import { formatDate, readingMinutes } from "@/lib/format";
import { extractHeadings } from "@/lib/headings";
import { getAdjacentMemos, getAllMemos, getMemo } from "@/lib/memos";
import { decodeParam } from "@/lib/params";
import { getAdjacentFeatured, getFeaturedPost, getFeaturedPosts } from "@/lib/posts";
import { getSiteUrl, site } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  const memos = getAllMemos().map((memo) => ({ slug: memo.slug }));
  const featured = getFeaturedPosts().map((post) => ({ slug: post.alias || post.slug }));
  return [...memos, ...featured];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const memo = getMemo(slug);
  if (memo) {
    const title = `产业与普通人备忘录：${memo.date}`;
    return {
      title,
      description: memo.excerpt,
      alternates: { canonical: memo.path },
      openGraph: {
        type: "article",
        title,
        description: memo.excerpt,
        publishedTime: memo.date,
        authors: [site.author],
        tags: memo.tags,
      },
    };
  }
  const post = getFeaturedPost(slug);
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

export default async function ArticleSlugPage({ params }: Props) {
  const slug = decodeParam((await params).slug);
  const memo = getMemo(slug);
  if (memo) {
    const { older, newer } = getAdjacentMemos(memo.slug);
    const headings = extractHeadings(memo.content);
    const url = `${getSiteUrl()}${memo.path}`;
    return (
      <ArticleView
        title={formatDate(memo.date)}
        date={memo.date}
        tags={memo.tags.map((name) => ({ name, href: tagHref("/memo", name) }))}
        content={memo.content}
        headings={headings}
        minutes={readingMinutes(memo.content)}
        showDate={false}
        crumbs={[{ href: "/memo", label: "产业与普通人备忘录" }]}
        older={older ? { href: older.path, title: formatDate(older.date) } : null}
        newer={newer ? { href: newer.path, title: formatDate(newer.date) } : null}
        olderLabel="前一天"
        newerLabel="后一天"
        pagerLabel="前后的备忘录"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: memo.title,
          datePublished: memo.date,
          dateModified: memo.date,
          description: memo.excerpt,
          inLanguage: "zh-CN",
          keywords: memo.tags.join(","),
          author: { "@type": "Person", name: site.author },
          publisher: { "@type": "Person", name: site.author },
          mainEntityOfPage: url,
        }}
      />
    );
  }

  const post = getFeaturedPost(slug);
  if (!post) notFound();
  const { older, newer } = getAdjacentFeatured(post.slug);
  const headings = extractHeadings(post.content);
  const url = `${getSiteUrl()}${post.path}`;
  return (
    <ArticleView
      title={post.title}
      date={post.date}
      tags={post.tags.map((name) => ({ name, href: tagHref("/articles", name) }))}
      content={post.content}
      headings={headings}
      minutes={readingMinutes(post.content)}
      crumbs={[{ href: "/articles", label: "文章" }]}
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
