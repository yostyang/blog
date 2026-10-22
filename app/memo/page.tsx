import type { Metadata } from "next";
import { LedgerList } from "@/components/LedgerList";
import { memoIndex, MemoMonth } from "@/components/MemoCalendar";
import { TagFilters } from "@/components/TagFilters";
import { shanghaiToday } from "@/lib/calendar";
import { getAllMemos, getMemoTags } from "@/lib/memos";
import type { MemoMeta } from "@/lib/types";

type Props = {
  searchParams: Promise<{ tag?: string | string[] }>;
};

function oneTag(value: string | string[] | undefined) {
  const tag = Array.isArray(value) ? value[0] : value;
  return tag?.trim() || "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const tag = oneTag((await searchParams).tag);
  const title = tag ? `「${tag}」相关备忘录` : "产业与普通人备忘录";
  return {
    title,
    description: "每天读官方新闻和产业数据，记下它们落到普通人账本上是什么样子。",
    alternates: { canonical: "/memo" },
  };
}

function monthsOf(memos: MemoMeta[]) {
  const keys = [...new Set(memos.map((memo) => memo.date.slice(0, 7)))].sort();
  return keys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year, month };
  });
}

export default async function MemoPage({ searchParams }: Props) {
  const tag = oneTag((await searchParams).tag);
  const all = getAllMemos();
  const visible = tag ? all.filter((memo) => memo.tags.includes(tag)) : all;
  const today = shanghaiToday();
  const groups = new Map<string, MemoMeta[]>();
  for (const memo of visible) {
    const key = memo.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(memo);
    groups.set(key, list);
  }
  const monthKeys = [...groups.keys()].sort().reverse();

  return (
    <main id="main">
      <div className="wrap">
        <div className="memo-head">
          <h1 className="page-title">产业与普通人备忘录</h1>
          <p className="page-lede">
            {tag
              ? `「${tag}」相关的 ${visible.length} 天。`
              : `每天读官方新闻和产业数据，记下它们落到普通人账本上是什么样子。已经记了 ${all.length} 天。`}
          </p>
        </div>
        <div className="memo-cals">
          {monthsOf(visible).map((month) => (
            <MemoMonth
              key={`${month.year}-${month.month}`}
              year={month.year}
              month={month.month}
              memos={memoIndex(visible)}
              today={today}
            />
          ))}
        </div>
        <TagFilters
          tags={getMemoTags()}
          active={tag || undefined}
          base="/memo"
          total={all.length}
          moreAfter={16}
        />
        <div className="memo-list">
          {monthKeys.map((key) => {
            const list = groups.get(key) ?? [];
            const [year, month] = key.split("-");
            return (
              <section key={key} aria-label={`${year}年${Number(month)}月`}>
                <h2 className="ledger-month">
                  {year}年{Number(month)}月<small>{list.length} 天</small>
                </h2>
                <LedgerList memos={list} />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
