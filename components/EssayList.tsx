import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { PostMeta } from "@/lib/types";

export function EssayList({ posts }: { posts: PostMeta[] }) {
  if (posts.length === 0) {
    return <p className="empty">没有匹配的文章</p>;
  }

  return (
    <ul className="essay-list">
      {posts.map((post) => (
        <li className={post.thumb ? "essay" : "essay no-cover"} key={post.slug}>
          <div>
            <div className="meta num">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>
            <Link className="title" href={`/posts/${post.slug}`}>
              <h3>{post.title}</h3>
            </Link>
            <p>{post.excerpt}</p>
            <ul className="tags">
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
          </div>
          {post.thumb ? (
            <Link href={`/posts/${post.slug}`} tabIndex={-1} aria-hidden="true">
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
