import type { Metadata } from "next";
import Link from "next/link";
import { MonthCalendar } from "@/components/WritingCalendar";
import { eachMonth, indexDays } from "@/lib/calendar";
import { CATEGORIES } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import { getAllPosts } from "@/lib/posts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于我",
  description: site.description,
  alternates: { canonical: "/me" },
};

export default function AboutPage() {
  const posts = getAllPosts();
  const newest = posts[0];
  const oldest = posts[posts.length - 1];
  const days = indexDays(posts);
  const months = newest && oldest ? eachMonth(oldest.date, newest.date) : [];
  const years = new Map<number, { year: number; month: number }[]>();
  for (const month of months) {
    const list = years.get(month.year) ?? [];
    list.push(month);
    years.set(month.year, list);
  }
  const counts = new Map<string, number>();
  for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);

  return (
    <main id="main">
      <div className="wrap narrow">
        <p className="eyebrow">About</p>
        <h1 className="page-title">{site.name}</h1>
        <p className="page-lede">{site.lede}</p>
        <p className="about-copy">
          {site.description}。这里是这些文章的全部存档
          {newest && oldest ? `，从${formatDate(oldest.date)}写到${formatDate(newest.date)}` : ""}。
        </p>
        <dl className="stats">
          <div>
            <dt>文章</dt>
            <dd>
              <b className="num">{posts.length}</b>
              <span>篇</span>
            </dd>
          </div>
          <div>
            <dt>写过的日子</dt>
            <dd>
              <b className="num">{days.size}</b>
              <span>天</span>
            </dd>
          </div>
          <div>
            <dt>专题</dt>
            <dd>
              <b className="num">{CATEGORIES.length}</b>
              <span>条线</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="wrap">
        <section className="section" aria-labelledby="calendar-title">
          <div className="section-head">
            <h2 id="calendar-title">写作日历</h2>
            <Link className="more" href="/articles">
              全部文章
            </Link>
          </div>
          <p className="card-note calendar-note">有颜色的日子写过文章，点一下打开那天的一篇。同一天有多篇时，打开排在最前的那篇。</p>
          <ul className="legend">
            {CATEGORIES.map((category) => (
              <li key={category.name}>
                <i className="swatch" data-cat={category.name} />
                {category.name}
              </li>
            ))}
          </ul>
          {[...years.entries()].reverse().map(([year, yearMonths]) => (
            <div className="year-block" key={year}>
              <h3 className="num">{year}</h3>
              <div className="month-grid">
                {yearMonths.map((month) => (
                  <MonthCalendar key={`${month.year}-${month.month}`} year={month.year} month={month.month} days={days} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="section" aria-labelledby="threads-title">
          <div className="section-head">
            <h2 id="threads-title">四条线</h2>
          </div>
          <div className="threads">
            {CATEGORIES.map((category) => (
              <article className="thread" key={category.name}>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <Link className="more" href={`/category/${category.name}`}>
                  {counts.get(category.name) ?? 0} 篇
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
