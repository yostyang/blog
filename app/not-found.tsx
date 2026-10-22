import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "页面没有找到",
};

export default function NotFound() {
  return (
    <main id="main">
      <div className="wrap narrow">
        <h1 className="page-title">页面没有找到</h1>
        <p className="page-lede">这个地址没有对应的页面。</p>
        <div className="not-found-actions">
          <Link className="btn" href="/">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
