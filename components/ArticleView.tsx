import Link from "next/link";
import { PostBody } from "@/components/PostBody";
import { ArticleToc, MobileToc } from "@/components/Toc";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";
import type { Heading } from "@/lib/types";

export type ArticleNeighbor = {
  href: string;
  title: string;
} | null;

export function ArticleView({
  title,
  date,
  tags,
  content,
  headings,
  minutes,
  showDate = true,
  crumbs,
  older,
  newer,
  olderLabel,
  newerLabel,
  pagerLabel,
  jsonLd,
}: {
  title: string;
  date: string;
  tags: { name: string; href: string }[];
  content: string;
  headings: Heading[];
  minutes: number;
  showDate?: boolean;
  crumbs: { href: string; label: string }[];
  older: ArticleNeighbor;
  newer: ArticleNeighbor;
  olderLabel: string;
  newerLabel: string;
  pagerLabel: string;
  jsonLd: Record<string, unknown>;
}) {
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
            <nav className="crumbs" aria-label="位置">
              {crumbs.map((crumb, index) => (
                <span key={crumb.href}>
                  {index > 0 ? (
                    <span className="sep" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  <Link href={crumb.href}>{crumb.label}</Link>
                </span>
              ))}
            </nav>
            <h1>{title}</h1>
            <div className="meta num">
              {showDate ? <time dateTime={date}>{formatDate(date)}</time> : null}
              <span>约 {minutes} 分钟读完</span>
            </div>
            {tags.length > 0 ? (
              <ul className="tags article-tags">
                {tags.map((tag) => (
                  <li key={tag.name}>
                    <Link className="tag" href={tag.href}>
                      {tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <MobileToc headings={headings} />
            <PostBody markdown={content} />
            <aside className="byline">
              <img src="/avatar.jpg" alt="" width={56} height={56} />
              <div>
                <strong>{site.author}</strong>
                <p>{site.byline}</p>
              </div>
            </aside>
            <nav className="pager" aria-label={pagerLabel}>
              <Neighbor post={older} direction="older" label={olderLabel} />
              <Neighbor post={newer} direction="newer" label={newerLabel} />
            </nav>
          </article>
          <ArticleToc headings={headings} />
        </div>
      </main>
    </>
  );
}

function Neighbor({
  post,
  direction,
  label,
}: {
  post: ArticleNeighbor;
  direction: "older" | "newer";
  label: string;
}) {
  if (!post) return <span />;
  return (
    <Link className={direction === "older" ? "prev" : "next"} href={post.href}>
      <span>{label}</span>
      {post.title}
    </Link>
  );
}
