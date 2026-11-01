/** A nav item is active on its own URL, or on a child path.
 *  `/` matches only the home page. A trailing slash on `href` is ignored,
 *  so `/marathon/` also covers `/marathon` and `/marathon/october`. */
export function pathMatches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  const base = href.endsWith("/") ? href.slice(0, -1) : href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Daily memos live at `/articles/memo-YYYY-MM-DD`, not under `/memo`. */
const MEMO_ARTICLE = "/articles/memo-";

export type NavItem = {
  name: string;
  href: string;
  active: (pathname: string) => boolean;
};

export const navItems: NavItem[] = [
  { name: "首页", href: "/", active: (path) => pathMatches(path, "/") },
  {
    name: "文章",
    href: "/articles",
    active: (path) =>
      !path.startsWith(MEMO_ARTICLE) &&
      (pathMatches(path, "/articles") ||
        pathMatches(path, "/category") ||
        pathMatches(path, "/posts") ||
        pathMatches(path, "/tag")),
  },
  {
    name: "备忘录",
    href: "/memo",
    active: (path) => pathMatches(path, "/memo") || path.startsWith(MEMO_ARTICLE),
  },
  { name: "关于我", href: "/me", active: (path) => pathMatches(path, "/me") },
  {
    name: "游戏",
    href: "/apo-game",
    active: (path) =>
      pathMatches(path, "/apo-game") ||
      pathMatches(path, "/pencil-garden") ||
      pathMatches(path, "/dayou") ||
      pathMatches(path, "/moving"),
  },
  {
    name: "运动健康",
    href: "/marathon/",
    active: (path) => pathMatches(path, "/marathon/"),
  },
  { name: "搜索", href: "/search", active: (path) => pathMatches(path, "/search") },
];

export function activeNavNames(pathname: string): string[] {
  return navItems.filter((item) => item.active(pathname)).map((item) => item.name);
}
