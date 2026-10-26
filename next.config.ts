import { readFileSync } from "fs";
import { join } from "path";
import type { NextConfig } from "next";

function escapePattern(source: string) {
  return source.replace(/[(){}:?+*]/g, "\\$&");
}

/** Browsers request non-ASCII paths percent-encoded. Next matches that raw path. */
function encodePath(source: string) {
  return source
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function loadLegacyRedirects(): { source: string; destination: string; permanent: true }[] {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "content/redirects.json"), "utf8"),
    ) as Record<string, string>;
    const rules: { source: string; destination: string; permanent: true }[] = [];
    for (const [source, destination] of Object.entries(raw)) {
      const encoded = escapePattern(encodePath(source));
      const plain = escapePattern(source);
      rules.push({ source: encoded, destination, permanent: true });
      if (plain !== encoded) {
        rules.push({ source: plain, destination, permanent: true });
      }
    }
    return rules;
  } catch {
    return [];
  }
}

/** Clean URLs for the self-hosted paper-playground games in public/. */
const gameRewrites: { source: string; destination: string }[] = [
  { source: "/apo-game", destination: "/apo-game/index.html" },
  { source: "/apo-game01", destination: "/apo-game01/index.html" },
  { source: "/apo-game02", destination: "/apo-game02/index.html" },
  { source: "/apo-game03", destination: "/apo-game03/index.html" },
  { source: "/apo-game04", destination: "/apo-game04/index.html" },
  { source: "/apo-game05", destination: "/apo-game05/index.html" },
  { source: "/apo-game05/intro", destination: "/apo-game05/intro.html" },
  { source: "/pencil-garden", destination: "/pencil-garden/index.html" },
  { source: "/pencil-garden/intro", destination: "/pencil-garden/intro.html" },
  { source: "/dayou", destination: "/dayou/index.html" },
  { source: "/moving", destination: "/moving/index.html" },
  { source: "/moving/game", destination: "/moving/game/index.html" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return gameRewrites;
  },
  async redirects() {
    return [
      // Explicit old copies first, so /posts/旧稿.html skips the generic hop.
      ...loadLegacyRedirects(),
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about", destination: "/me", permanent: true },
      {
        source: "/posts/:slug.html",
        destination: "/posts/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
