"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { EssayList } from "@/components/EssayList";
import { commitQuery, useSiteQuery } from "@/lib/query";
import type { PostMeta } from "@/lib/types";

function matches(post: PostMeta, query: string) {
  const haystack = `${post.title}\n${post.excerpt}\n${post.category}\n${post.tags.join("\n")}`.toLowerCase();
  return haystack.includes(query);
}

export function SearchScreen({ posts }: { posts: PostMeta[] }) {
  const query = useSiteQuery();
  const pathname = usePathname();
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? query;
  const needle = query.trim().toLowerCase();
  const visible = needle ? posts.filter((post) => matches(post, needle)) : [];

  function publish(next: string) {
    setDraft(null);
    commitQuery(next, pathname);
  }

  return (
    <main id="main">
      <div className="wrap search-wrap">
        <h1 className="page-title">搜索</h1>
        <form
          className="search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            publish(value);
          }}
        >
          <label className="visually-hidden" htmlFor="q">
            搜索文章
          </label>
          <input
            id="q"
            type="search"
            placeholder="比如：极氪、马拉松、减重"
            value={value}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              const next = event.target.value;
              if (composing.current) {
                setDraft(next);
                return;
              }
              publish(next);
            }}
            onCompositionStart={() => {
              composing.current = true;
              setDraft(value);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              publish(event.currentTarget.value);
            }}
          />
          <button className="btn" type="submit">
            搜索
          </button>
        </form>
        <p className="result-count">
          {needle ? `找到 ${visible.length} 篇` : "按标题、摘要、专题或标签查找。"}
        </p>
        {needle ? <EssayList posts={visible} /> : null}
      </div>
    </main>
  );
}
