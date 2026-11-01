"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="主导航">
      {navItems.map((link) => {
        const active = link.active(pathname);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
