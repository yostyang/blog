import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { getSiteUrl, site } from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#11151c" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${site.name}｜${site.tagline}`,
    template: `%s｜${site.name}`,
  },
  description: site.description,
  authors: [{ name: site.author }],
  applicationName: site.name,
  alternates: {
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    title: site.name,
    description: site.description,
    images: [{ url: "/avatar.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
  },
  icons: {
    icon: [{ url: "/avatar.jpg", type: "image/jpeg" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip" href="#main">
          跳到内容
        </a>
        <Header />
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <div>
              <strong>{site.name}</strong>
              <p>{site.description}</p>
            </div>
            <nav aria-label="页脚">
              <Link href="/articles">全部文章</Link>
              <Link href="/me">关于我</Link>
              <Link href="/search">搜索</Link>
              <a href="/rss.xml">RSS 订阅</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
