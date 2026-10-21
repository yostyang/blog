export const site = {
  name: "约斯特普通",
  author: "约斯特普通",
  tagline: "电车、跑步与中年生活",
  description: "一个普通中年男人的电车、跑步、生活与成长记录",
  lede: "记录电车出行、跑步、中年成长和生活。少讲道理，多讲真实体验。",
  locale: "zh_CN",
  language: "zh-CN",
} as const;

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
