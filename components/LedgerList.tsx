import Link from "next/link";
import { ledgerStamp, weekdayName } from "@/lib/calendar";
import { tagHref } from "@/lib/essay";
import type { MemoMeta } from "@/lib/types";

export function LedgerList({ memos }: { memos: MemoMeta[] }) {
  return (
    <ol className="ledger">
      {memos.map((memo) => (
        <li className="ledger-row" key={memo.slug}>
          <div className="ledger-date">
            <time dateTime={memo.date}>
              <b>{ledgerStamp(memo.date)}</b>
              <span>{weekdayName(memo.date)}</span>
            </time>
          </div>
          <div className="ledger-body">
            <Link className="line" href={memo.path}>
              {memo.excerpt}
            </Link>
            {memo.tags.length > 0 ? (
              <ul className="tags">
                {memo.tags.map((tag) => (
                  <li key={tag}>
                    <Link className="tag" href={tagHref("/memo", tag)}>
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
