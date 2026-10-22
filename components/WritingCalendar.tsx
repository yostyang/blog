import Link from "next/link";
import { monthGrid, type DayMark } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthCalendar({
  year,
  month,
  days,
}: {
  year: number;
  month: number;
  days: Map<string, DayMark>;
}) {
  const { pad, days: count } = monthGrid(year, month);
  const label = `${year}年${month}月`;
  const cells = [
    ...Array.from({ length: pad }, (_, index) => ({ kind: "pad" as const, key: `pad-${index}` })),
    ...Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { kind: "day" as const, key: iso, day, iso, mark: days.get(iso) };
    }),
  ];

  return (
    <figure className="cal-month">
      <figcaption>{label}</figcaption>
      <div className="cal" role="grid" aria-label={`${label}写作日历`}>
        {WEEKDAYS.map((name) => (
          <span className="dow" aria-hidden="true" key={name}>
            {name}
          </span>
        ))}
        {cells.map((cell) => {
          if (cell.kind === "pad") return <span className="d pad" key={cell.key} />;
          if (!cell.mark) {
            return (
              <span className="d" key={cell.key}>
                {cell.day}
              </span>
            );
          }
          const { post, count: posts } = cell.mark;
          const written = formatDate(cell.iso);
          const aria =
            posts > 1 ? `${written}，${posts} 篇，打开${post.title}` : `${written}，${post.title}`;
          return (
            <Link
              className="d"
              data-cat={post.category}
              href={`/posts/${post.slug}`}
              key={cell.key}
              aria-label={aria}
              title={posts > 1 ? `${written} · ${posts} 篇` : post.title}
            >
              {cell.day}
            </Link>
          );
        })}
      </div>
    </figure>
  );
}
