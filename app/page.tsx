import type { Metadata } from "next";
import Link from "next/link";
import { EssayList } from "@/components/EssayList";
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
            <aside className="intro-card" aria-labelledby="topics-title">
              <h2 id="topics-title">按专题看</h2>
              <p className="card-note">电车、跑步、中年成长和生活，四本一直在写的记录。</p>
              <ul className="topic-list">
                {CATEGORIES.map((category) => (
                  <li key={category.name}>
                    <Link href={`/category/${category.name}`}>
                      {category.name}
                      <small>{counts.get(category.name) ?? 0}</small>
                    </Link>
                  </li>
                ))}
              </ul>
              {latest ? (
                <Link className="card-latest" href={`/posts/${latest.slug}`}>
                  <span>最新</span>
                  {latest.title}
                </Link>
              ) : null}
            </aside>
          </section>
          <section className="section" aria-labelledby="latest-title">
            <div className="section-head">
              <h2 id="latest-title">最新文章</h2>
              <Link className="more" href="/articles">
                全部文章
              </Link>
            </div>
            <EssayList posts={posts.slice(0, 8)} />
          </section>
        </div>
      </main>
    </>
  );
}
