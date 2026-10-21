import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { QueryBridge } from "@/components/QueryBridge";
import { site } from "@/lib/site";

export function Header() {
  return (
    <header className="site-header">
      <QueryBridge />
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${site.name} 首页`}>
          <img src="/avatar.jpg" alt="" width={36} height={36} />
          <span>
            <span className="brand-name">{site.name}</span>
            <span className="brand-line">{site.tagline}</span>
          </span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
