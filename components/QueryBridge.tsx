"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { adoptQuery } from "@/lib/query";

function currentQuery() {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

export function QueryBridge() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      adoptQuery(currentQuery());
    }
    function onPopState() {
      adoptQuery(currentQuery());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pathname]);

  return null;
}
