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
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png" }],
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
            <div className="follow">
              <img src="/qrcode.jpg" alt="公众号「约斯特普通」二维码" width={88} height={88} />
              <div>
                <strong>扫码关注约斯特普通</strong>
                <p>用车体验、纯电转型记录和长期测评，公众号同步更新。</p>
              </div>
            </div>
            <nav aria-label="页脚">
              <Link href="/articles">全部文章</Link>
              <Link href="/memo">备忘录</Link>
              <a href="/rss.xml">RSS 订阅</a>
              <Link href="/me">关于我</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
