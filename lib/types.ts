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
};

export type Post = PostMeta & {
  content: string;
};

export type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};
