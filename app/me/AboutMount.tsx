"use client";

import { useEffect } from "react";

export function AboutMount({ html, script }: { html: string; script: string }) {
  useEffect(() => {
    const root = document.getElementById("top");
    if (!root || root.dataset.booted === "1") return;
    root.dataset.booted = "1";
    new Function(script)();
  }, [script]);

  return <div className="me-page" id="main" dangerouslySetInnerHTML={{ __html: html }} />;
}
