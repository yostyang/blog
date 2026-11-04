import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export {}", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`].find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
    if (!hit) throw new Error(`Cannot resolve ${specifier}`);
    return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
