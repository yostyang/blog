import type { Metadata } from "next";
import Link from "next/link";
import { EssayList } from "@/components/EssayList";
import { MonthCalendar } from "@/components/WritingCalendar";
import { indexDays } from "@/lib/calendar";
import { CATEGORIES } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { getSiteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: `${site.name}｜${site.tagline}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.name}｜${site.tagline}`,
    description: site.description,
  },
};

export default function HomePage() {
  const posts = getAllPosts();
  const latest = posts[0];
  const days = indexDays(posts);
  const [calYear, calMonth] = latest ? latest.date.split("-").map(Number) : [0, 0];
  const counts = new Map<string, number>();
  for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: site.name,
    description: site.description,
    url: getSiteUrl(),
    inLanguage: "zh-CN",
    author: { "@type": "Person", name: site.author },
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
        <div className="wrap">
          <section className="intro">
            <div className="intro-copy">
              <h1 className="page-title">一个普通中年男人的记录。</h1>
              <p className="page-lede">{site.lede}</p>
              <div className="intro-actions">
                <Link className="btn" href="/articles">
                  浏览全部文章
                </Link>
              </div>
            </div>
            <aside className="intro-card" aria-labelledby="cal-title">
              <h2 id="cal-title">写作日历</h2>
              <p className="card-note">
                有颜色的日子写过文章。
                <Link href="/me">完整日历</Link>
                在关于我。
              </p>
              {latest ? <MonthCalendar year={calYear} month={calMonth} days={days} /> : null}
              {latest ? (
                <Link className="card-latest" href={`/posts/${latest.slug}`}>
                  <span className="num">最新 · {latest.date.replaceAll("-", ".")}</span>
                  {latest.title}
                </Link>
              ) : null}
            </aside>
          </section>
          <section className="section" aria-labelledby="latest-title">
            <div className="section-head">
              <h2 id="latest-title">最新文章</h2>
              <Link className="more" href="/articles">
                全部 {posts.length} 篇文章
              </Link>
            </div>
            <EssayList posts={posts.slice(0, 6)} />
          </section>
          <section className="section" aria-labelledby="topics-title">
            <div className="section-head">
              <h2 id="topics-title">按专题读</h2>
            </div>
            <nav className="filters" aria-labelledby="topics-title">
              {CATEGORIES.map((category) => (
                <Link key={category.name} href={`/category/${category.name}`}>
                  {category.name}
                  <small>{counts.get(category.name) ?? 0}</small>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </main>
    </>
  );
}
