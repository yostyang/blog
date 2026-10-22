"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { Heading } from "@/lib/types";

function useActiveHeading(headings: Heading[]) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const nodes = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    function spy() {
      const position = window.scrollY + 96;
      let current = nodes[0];
      for (const node of nodes) {
        if (node.offsetTop <= position) current = node;
      }
      setActive(current.id);
    }

    spy();
    window.addEventListener("scroll", spy, { passive: true });
    return () => window.removeEventListener("scroll", spy);
  }, [headings]);

  return active;
}

function scrollToHeading(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

export function ArticleToc({ headings }: { headings: Heading[] }) {
  const active = useActiveHeading(headings);
  if (headings.length < 2) return null;

  return (
    <nav className="toc" aria-label="目录">
      <h2>目录</h2>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "l3" : "l2"}>
            <a
              href={`#${heading.id}`}
              aria-current={active === heading.id ? "true" : undefined}
              onClick={(event) => scrollToHeading(event, heading.id)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MobileToc({ headings }: { headings: Heading[] }) {
  if (headings.length < 2) return null;

  return (
    <details className="toc-mobile">
      <summary>目录 · {headings.length} 节</summary>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "l3" : "l2"}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}
