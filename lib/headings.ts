import type { Heading } from "@/lib/types";

function unescapeMarkdown(value: string) {
  return value
    .replace(/\\([\\*`_[\]#>\-+.])/g, "$1")
    .replace(/&lt;/g, "<")
    .trim();
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level !== 2 && level !== 3) continue;
    headings.push({
      id: `sec-${headings.length}`,
      text: unescapeMarkdown(match[2]),
      level,
    });
  }
  return headings;
}
