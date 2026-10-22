import type { PostMeta } from "@/lib/types";

export type DayMark = {
  post: PostMeta;
  count: number;
};

export function indexDays(posts: PostMeta[]) {
  const days = new Map<string, DayMark>();
  for (const post of posts) {
    const current = days.get(post.date);
    if (!current) days.set(post.date, { post, count: 1 });
    else current.count += 1;
  }
  return days;
}

export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  let pad = first.getUTCDay() - 1;
  if (pad < 0) pad = 6;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { pad, days };
}

export function eachMonth(startIso: string, endIso: string) {
  const [startYear, startMonth] = startIso.split("-").map(Number);
  const [endYear, endMonth] = endIso.split("-").map(Number);
  const months: { year: number; month: number }[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
