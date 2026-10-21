import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getAllPosts, getAllTags } from "@/lib/posts";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteUrl();
  const posts = getAllPosts();
  const latest = posts[0]?.date;

  return [
    {
      url: origin,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/articles`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/search`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...CATEGORIES.map((category) => ({
      url: `${origin}/category/${encodeURIComponent(category.name)}`,
      lastModified: posts.find((post) => post.category === category.name)?.date,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...getAllTags().map((tag) => ({
      url: `${origin}/tag/${encodeURIComponent(tag.name)}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...posts.map((post) => ({
      url: `${origin}/posts/${encodeURIComponent(post.slug)}`,
      lastModified: post.date,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
