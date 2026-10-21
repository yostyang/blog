import Link from "next/link";
import { EssayList } from "@/components/EssayList";
import { CATEGORIES } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import type { PostMeta } from "@/lib/types";

export function ArticleIndex({
  posts,
  title,
  lede,
  active,
}: {
  posts: PostMeta[];
  title: string;
  lede: string;
  active: string;
}) {
  const all = getAllPosts();
  const counts = new Map<string, number>();
  for (const post of all) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);

  return (
    <main id="main">
      <div className="wrap narrow">
        <h1 className="page-title">{title}</h1>
        <p className="page-lede">{lede}</p>
        <nav className="filters" aria-label="按专题筛选">
          <Link href="/articles" aria-current={active === "all" ? "true" : undefined}>
            全部<small>{all.length}</small>
          </Link>
          {CATEGORIES.map((category) => (
            <Link
              key={category.name}
              href={`/category/${category.name}`}
              aria-current={active === category.name ? "true" : undefined}
            >
              {category.name}
              <small>{counts.get(category.name) ?? 0}</small>
            </Link>
          ))}
        </nav>
        <EssayList posts={posts} />
      </div>
    </main>
  );
}
