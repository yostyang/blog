import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import nextConfig from "../next.config.ts";

const root = path.join(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const marathonDir = path.join(publicDir, "marathon");

test("every file the marathon pages reference exists", () => {
  const referenced = localReferences();
  assert.ok(referenced.length > 0, "marathon pages did not reference any local files");

  const missing = referenced.filter((rel) => !fs.existsSync(path.join(publicDir, rel)));
  assert.deepEqual(missing, [], "public/marathon references a file that is not in the repo");

  const outputDir = path.join(root, ".next/output/static");
  if (fs.existsSync(outputDir)) {
    const absent = referenced.filter((rel) => !fs.existsSync(path.join(outputDir, rel)));
    assert.deepEqual(absent, [], "referenced marathon files were not copied into the build output");
  }
});

test("marathon routes stay on this deployment", async () => {
  const rewrites = await nextConfig.rewrites();
  const redirects = await nextConfig.redirects();
  const rules = [...asRules(rewrites), ...redirects];
  const external = rules.filter(
    (rule) => rule.source.startsWith("/marathon") && /^https?:\/\//.test(rule.destination),
  );
  assert.deepEqual(
    external,
    [],
    "a /marathon route points at another host, so public/marathon would not be served",
  );
});

function asRules(
  rewrites: Awaited<ReturnType<NonNullable<typeof nextConfig.rewrites>>>,
): { source: string; destination: string }[] {
  if (Array.isArray(rewrites)) return rewrites;
  return [...rewrites.beforeFiles, ...rewrites.afterFiles, ...rewrites.fallback];
}

function localReferences() {
  const refs = new Set<string>();
  for (const file of walk(marathonDir)) {
    if (!/\.(html|css|js|svg)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const raw of quotedRefs(text)) {
      const rel = resolveRef(file, raw);
      if (rel) refs.add(rel);
    }
  }
  return [...refs].sort();
}

function quotedRefs(text: string) {
  const found: string[] = [];
  const attr = /(?:href|src)\s*=\s*["']([^"']+)["']/g;
  const url = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  for (const match of text.matchAll(attr)) found.push(match[1]);
  for (const match of text.matchAll(url)) found.push(match[1]);
  return found;
}

function resolveRef(fromFile: string, raw: string) {
  const value = raw.split("#")[0]?.split("?")[0] ?? "";
  if (!value || value.startsWith("#") || value.startsWith("data:") || value.startsWith("mailto:")) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const absolute = value.startsWith("/")
    ? path.join(publicDir, value)
    : path.resolve(path.dirname(fromFile), value);
  const rel = path.relative(publicDir, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
