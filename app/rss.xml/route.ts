import { getAllMemos } from "@/lib/memos";
import { getAllPosts } from "@/lib/posts";
import { getSiteUrl, site } from "@/lib/site";

export const dynamic = "force-static";

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GET() {
  const origin = getSiteUrl();
  const entries = [
    ...getAllPosts().map((post) => ({
      title: post.title,
      link: `${origin}${post.path}`,
      date: post.date,
      excerpt: post.excerpt,
      categories: [post.category, ...post.tags],
    })),
    ...getAllMemos().map((memo) => ({
      title: memo.title,
      link: `${origin}${memo.path}`,
      date: memo.date,
      excerpt: memo.excerpt,
      categories: memo.tags,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const items = entries
    .map((entry) => {
      const description = entry.excerpt.replace(/]]>/g, "]]&gt;");
      const categories = entry.categories.map((category) => `<category>${xml(category)}</category>`).join("");
      return `<item>
      <title>${xml(entry.title)}</title>
      <link>${entry.link}</link>
      <guid isPermaLink="true">${entry.link}</guid>
      <pubDate>${new Date(`${entry.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      ${categories}
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(site.name)}</title>
    <link>${origin}</link>
    <description>${xml(site.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
