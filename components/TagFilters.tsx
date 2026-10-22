import Link from "next/link";

export function TagFilters({
  tags,
  active,
  base,
  total,
  moreAfter,
}: {
  tags: { name: string; count: number }[];
  active?: string;
  base: "/articles" | "/memo";
  total: number;
  moreAfter?: number;
}) {
  const visible = moreAfter ? tags.slice(0, moreAfter) : tags;
  const extra = moreAfter ? tags.slice(moreAfter) : [];
  return (
    <nav className="filters" aria-label={base === "/memo" ? "按话题筛选备忘录" : "按话题筛选"}>
      <Link href={base} aria-current={active ? undefined : "true"}>
        全部<small>{total}</small>
      </Link>
      {visible.map((tag) => (
        <Link
          key={tag.name}
          href={`${base}?tag=${encodeURIComponent(tag.name)}`}
          aria-current={active === tag.name ? "true" : undefined}
        >
          {tag.name}
          <small>{tag.count}</small>
        </Link>
      ))}
      {extra.length > 0 ? (
        <details className="more-tags">
          <summary>更多话题 {extra.length}</summary>
          <div className="filters">
            {extra.map((tag) => (
              <Link
                key={tag.name}
                href={`${base}?tag=${encodeURIComponent(tag.name)}`}
                aria-current={active === tag.name ? "true" : undefined}
              >
                {tag.name}
                <small>{tag.count}</small>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
