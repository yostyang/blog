import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { EssayListItem } from "@/lib/types";

export function EssayList({ posts }: { posts: EssayListItem[] }) {
  if (posts.length === 0) {
    return <p className="empty">没有匹配的文章</p>;
  }

  return (
    <ul className="essay-list">
      {posts.map((post) => (
        <li className={post.thumb ? "essay" : "essay no-cover"} key={post.key}>
          <div>
            <div className="meta num">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>
            <Link className="title" href={post.href}>
              <h3>{post.title}</h3>
            </Link>
            <p>{post.excerpt}</p>
            {post.tags.length > 0 ? (
              <ul className="tags">
                {post.tags.map((tag) => (
                  <li key={tag.name}>
                    <Link className="tag" href={tag.href}>
                      {tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {post.thumb ? (
            <Link href={post.href} tabIndex={-1} aria-hidden="true">
              <img
                className="cover"
                src={post.thumb}
                alt=""
                width={152}
                height={114}
                loading="lazy"
                decoding="async"
              />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
