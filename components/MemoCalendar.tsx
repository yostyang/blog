import Link from "next/link";
import { monthGrid, weekLabel } from "@/lib/calendar";
import type { MemoMeta } from "@/lib/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function DayCell({
  iso,
  day,
  memo,
  today,
  label,
}: {
  iso: string;
  day: number;
  memo: MemoMeta | undefined;
  today: string;
  label: string;
}) {
  const todayClass = iso === today ? " today" : "";
  if (!memo) {
    return (
      <span className={`d${todayClass}`} key={iso}>
        {day}
      </span>
    );
  }
  return (
    <Link
      className={`d${todayClass}`}
      href={memo.path}
      key={iso}
      title={memo.excerpt}
      aria-label={`${label}${day}日，${memo.excerpt}`}
    >
      {day}
    </Link>
  );
}

export function WeekCalendar({
  days,
  memos,
  today,
}: {
  days: string[];
  memos: Map<string, MemoMeta>;
  today: string;
}) {
  const label = weekLabel(days);
  return (
    <figure className="cal-month">
      <figcaption>{label}</figcaption>
      <div className="cal" role="grid" aria-label={`${label}备忘录日历`}>
        {WEEKDAYS.map((name) => (
          <span className="dow" aria-hidden="true" key={name}>
            {name}
          </span>
        ))}
        {days.map((iso) => (
          <DayCell
            key={iso}
            iso={iso}
            day={Number(iso.slice(8))}
            memo={memos.get(iso)}
            today={today}
            label={label}
          />
        ))}
      </div>
    </figure>
  );
}

export function MemoMonth({
  year,
  month,
  memos,
  today,
}: {
  year: number;
  month: number;
  memos: Map<string, MemoMeta>;
  today: string;
}) {
  const { pad, days: count } = monthGrid(year, month);
  const label = `${year}年${month}月`;
  const cells = [
    ...Array.from({ length: pad }, (_, index) => ({ kind: "pad" as const, key: `pad-${index}` })),
    ...Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { kind: "day" as const, key: iso, day, iso };
    }),
  ];

  return (
    <figure className="cal-month">
      <figcaption>{label}</figcaption>
      <div className="cal" role="grid" aria-label={`${label}备忘录日历`}>
        {WEEKDAYS.map((name) => (
          <span className="dow" aria-hidden="true" key={name}>
            {name}
          </span>
        ))}
        {cells.map((cell) => {
          if (cell.kind === "pad") return <span className="d pad" key={cell.key} />;
          return (
            <DayCell
              key={cell.key}
              iso={cell.iso}
              day={cell.day}
              memo={memos.get(cell.iso)}
              today={today}
              label={label}
            />
          );
        })}
      </div>
    </figure>
  );
}

export function memoIndex(memos: MemoMeta[]) {
  const days = new Map<string, MemoMeta>();
  for (const memo of memos) days.set(memo.date, memo);
  return days;
}
