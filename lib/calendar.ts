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

export function shanghaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function weekContaining(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(date);
    next.setUTCDate(date.getUTCDate() + offset + index);
    return next.toISOString().slice(0, 10);
  });
}

export function weekLabel(days: string[]) {
  const [, startMonth, startDay] = days[0].split("-").map(Number);
  const [, endMonth, endDay] = days[6].split("-").map(Number);
  if (startMonth === endMonth) return `${startMonth}月${startDay}日 – ${endDay}日`;
  return `${startMonth}月${startDay}日 – ${endMonth}月${endDay}日`;
}

export function weekdayName(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `周${"日一二三四五六"[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}`;
}

export function ledgerStamp(iso: string) {
  const [, month, day] = iso.split("-");
  return `${month}.${day}`;
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
