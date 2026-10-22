export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  excerpt: string;
  thumb: string | null;
  cover: string | null;
  order: number;
  featured: boolean;
  alias: string | null;
  path: string;
};

export type MemoMeta = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  order: number;
  path: string;
};

export type Memo = MemoMeta & {
  content: string;
};

export type EssayListItem = {
  key: string;
  href: string;
  title: string;
  date: string;
  excerpt: string;
  thumb: string | null;
  tags: { name: string; href: string }[];
};

export type Post = PostMeta & {
  content: string;
};

export type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};
