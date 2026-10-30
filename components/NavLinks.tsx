"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { name: "首页", href: "/", current: (path: string) => path === "/" },
  {
    name: "文章",
    href: "/articles",
    current: (path: string) =>
      path === "/articles" ||
      (path.startsWith("/articles/") && !path.startsWith("/articles/memo-")) ||
      path.startsWith("/category") ||
      path.startsWith("/posts") ||
      path.startsWith("/tag"),
  },
  {
    name: "备忘录",
    href: "/memo",
    current: (path: string) => path.startsWith("/memo") || path.startsWith("/articles/memo-"),
  },
  { name: "关于我", href: "/me", current: (path: string) => path.startsWith("/me") },
  {
    name: "游戏",
    href: "/apo-game",
    current: (path: string) =>
      path.startsWith("/apo-game") ||
      path.startsWith("/pencil-garden") ||
      path.startsWith("/dayou") ||
      path.startsWith("/moving"),
  },
  {
    name: "运动健康",
    href: "/marathon/",
    current: (path: string) => path.startsWith("/marathon"),
  },
  { name: "搜索", href: "/search", current: (path: string) => path.startsWith("/search") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="主导航">
      {links.map((link) => {
        const active = link.current(pathname);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
