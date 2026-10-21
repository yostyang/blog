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
  const posts = getAllPosts();
  const items = posts
    .map((post) => {
      const link = `${origin}/posts/${encodeURIComponent(post.slug)}`;
      const description = post.excerpt.replace(/]]>/g, "]]&gt;");
      return `<item>
      <title>${xml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <category>${xml(post.category)}</category>
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
