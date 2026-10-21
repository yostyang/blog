import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleIndex } from "@/components/ArticleIndex";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { decodeParam } from "@/lib/params";
import { getPostsByCategory } from "@/lib/posts";

type Props = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.name }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = decodeParam((await params).category);
  const current = getCategory(category);
  if (!current) return { title: "未找到专题" };
  return {
    title: current.name,
    description: current.description,
    alternates: { canonical: `/category/${current.name}` },
    openGraph: {
      title: current.name,
      description: current.description,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const category = decodeParam((await params).category);
  const current = getCategory(category);
  if (!current) notFound();
  const posts = getPostsByCategory(current.name);
  return (
    <ArticleIndex
      posts={posts}
      title={current.name}
      lede={current.description}
      active={current.name}
    />
  );
}
