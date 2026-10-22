import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getAllMemos } from "@/lib/memos";
import { getAllPosts, getAllTags } from "@/lib/posts";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteUrl();
  const posts = getAllPosts();
  const memos = getAllMemos();
  const latest = [posts[0]?.date, memos[0]?.date].filter(Boolean).sort().at(-1);

  return [
    { url: origin, lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/articles`, lastModified: posts.find((post) => post.featured)?.date, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/memo`, lastModified: memos[0]?.date, changeFrequency: "daily", priority: 0.8 },
    { url: `${origin}/search`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/me`, changeFrequency: "monthly", priority: 0.4 },
    ...CATEGORIES.map((category) => ({
      url: `${origin}/category/${encodeURIComponent(category.name)}`,
      lastModified: posts.find((post) => post.category === category.name)?.date,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...getAllTags().map((tag) => ({
      url: `${origin}/tag/${encodeURIComponent(tag.name)}`,
      changeFrequency: "weekly" as const,
      priority: 0.3,
    })),
    ...posts.map((post) => ({
      url: `${origin}${post.path}`,
      lastModified: post.date,
      changeFrequency: "yearly" as const,
      priority: post.featured ? 0.7 : 0.5,
    })),
    ...memos.map((memo) => ({
      url: `${origin}${memo.path}`,
      lastModified: memo.date,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
