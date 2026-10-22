"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { EssayList } from "@/components/EssayList";
import { commitQuery, useSiteQuery } from "@/lib/query";
import type { SearchDoc } from "@/lib/essay";

export function SearchScreen({ docs }: { docs: SearchDoc[] }) {
  const query = useSiteQuery();
  const pathname = usePathname();
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? query;
  const needle = query.trim().toLowerCase();
  const visible = needle ? docs.filter((doc) => doc.haystack.includes(needle)) : [];

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
            搜索文章和备忘录
          </label>
          <input
            id="q"
            type="search"
            placeholder="比如：极氪、马拉松、以旧换新"
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
          {needle ? (
            <>
              「{query.trim()}」找到 <b className="num">{visible.length}</b> 篇，搜索范围包括标题、摘要、标签和正文。
            </>
          ) : (
            "按标题、摘要、标签或正文查找。"
          )}
        </p>
        {needle ? <EssayList posts={visible} /> : null}
      </div>
    </main>
  );
}
