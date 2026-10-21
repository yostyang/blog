import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/PostBody";
import { ArticleToc, MobileToc } from "@/components/Toc";
import { extractHeadings } from "@/lib/headings";
import { formatDate, readingMinutes } from "@/lib/format";
import { decodeParam } from "@/lib/params";
import { getAdjacent, getAllPosts, getPost } from "@/lib/posts";
import { getSiteUrl, site } from "@/lib/site";
import type { PostMeta } from "@/lib/types";

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
    alternates: { canonical: `/posts/${post.slug}` },
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

function Neighbor({
  post,
  direction,
}: {
  post: PostMeta | null;
  direction: "older" | "newer";
}) {
  if (!post) return <span />;
  return (
    <Link className={direction === "older" ? "prev" : "next"} href={`/posts/${post.slug}`}>
      <span>{direction === "older" ? "上一篇" : "下一篇"}</span>
      {post.title}
    </Link>
  );
}

export default async function PostPage({ params }: Props) {
  const slug = decodeParam((await params).slug);
  const post = getPost(slug);
  if (!post) notFound();
  const { older, newer } = getAdjacent(post.slug);
  const headings = extractHeadings(post.content);
  const minutes = readingMinutes(post.content);
  const url = `${getSiteUrl()}/posts/${post.slug}`;
  const jsonLd = {
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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main">
        <div className="wrap article-grid">
          <article>
            <p className="crumbs">
              <Link href="/articles">文章</Link>
              <span className="sep" aria-hidden="true">
                /
              </span>
              <Link href={`/category/${post.category}`}>{post.category}</Link>
            </p>
            <h1>{post.title}</h1>
            <div className="meta num">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>约 {minutes} 分钟读完</span>
            </div>
            <ul className="tags article-tags">
              <li>
                <Link className="tag" href={`/category/${post.category}`}>
                  {post.category}
                </Link>
              </li>
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link className="tag" href={`/tag/${tag}`}>
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
            <MobileToc headings={headings} />
            <PostBody markdown={post.content} />
            <div className="byline">
              <img src="/avatar.jpg" alt="" width={56} height={56} />
              <div>
                <strong>{site.author}</strong>
                <p>{site.description}</p>
              </div>
            </div>
            <nav className="pager" aria-label="相邻文章">
              <Neighbor post={older} direction="older" />
              <Neighbor post={newer} direction="newer" />
            </nav>
          </article>
          <ArticleToc headings={headings} />
        </div>
      </main>
    </>
  );
}
