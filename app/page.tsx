import type { Metadata } from "next";
import Link from "next/link";
import { EssayList } from "@/components/EssayList";
import { LedgerList } from "@/components/LedgerList";
import { memoIndex, WeekCalendar } from "@/components/MemoCalendar";
import { shanghaiToday, weekContaining } from "@/lib/calendar";
import { essayFromPost } from "@/lib/essay";
import { formatDate } from "@/lib/format";
import { getAllMemos } from "@/lib/memos";
import { getFeaturedPosts, getFeaturedTags } from "@/lib/posts";
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
  const posts = getFeaturedPosts();
  const memos = getAllMemos();
  const latest = memos[0];
  const today = shanghaiToday();
  const week = weekContaining(today);
  const tags = getFeaturedTags().filter((tag) => tag.count >= 2);
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
              <h1 className="page-title">{site.hero}</h1>
              <p className="page-lede">{site.lede}</p>
              <div className="intro-actions">
                <Link className="btn" href="/articles">
                  浏览全部文章
                </Link>
              </div>
            </div>
            <aside className="intro-card" aria-labelledby="cal-title">
              <h2 id="cal-title">产业与普通人备忘录</h2>
              <p className="card-note">
                每天一篇，从官方叙事和产业变化里，记下普通人的账本。蓝色的日子可以点开，
                <Link href="/memo">完整日历</Link>
                在备忘录页。
              </p>
              <WeekCalendar days={week} memos={memoIndex(memos)} today={today} />
              {latest ? (
                <Link className="card-latest" href={latest.path}>
                  <span className="num">最新 · {formatDate(latest.date)}</span>
                  {latest.excerpt}
                </Link>
              ) : null}
            </aside>
          </section>

          <section className="section" aria-labelledby="picks">
            <div className="section-head">
              <h2 id="picks">推荐阅读</h2>
              <Link className="more" href="/articles">
                全部 {posts.length} 篇文章
              </Link>
            </div>
            <EssayList posts={posts.slice(0, 6).map(essayFromPost)} />
          </section>

          <section className="section" aria-labelledby="recent-memos">
            <div className="section-head">
              <h2 id="recent-memos">最近的备忘录</h2>
              <Link className="more" href="/memo">
                共 {memos.length} 天
              </Link>
            </div>
            <LedgerList memos={memos.slice(0, 6)} />
          </section>

          <section className="section" aria-labelledby="topics">
            <div className="section-head">
              <h2 id="topics">按话题读</h2>
            </div>
            <nav className="filters" aria-labelledby="topics">
              {tags.map((tag) => (
                <Link key={tag.name} href={`/articles?tag=${encodeURIComponent(tag.name)}`}>
                  {tag.name}
                  <small>{tag.count}</small>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </main>
    </>
  );
}
