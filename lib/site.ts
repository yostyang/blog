export const site = {
  name: "约斯特普通",
  author: "约斯特普通",
  tagline: "7年插混车主转纯电",
  description: "约斯特普通的个人博客：纯电车主的用车记录、跑步训练，以及每天一篇的「产业与普通人备忘录」。",
  hero: "7年新能源车主，插混转纯电。",
  lede: "记录新能源、跑步、副业和中年生活实验。少讲道理，多讲真实体验。",
  byline: "7 年插混车主转纯电。写用车、跑步，也每天记一篇产业与普通人备忘录。公众号二维码在页面最下方。",
  locale: "zh_CN",
  language: "zh-CN",
  url: "https://yostyang.com",
} as const;

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return site.url;
}
