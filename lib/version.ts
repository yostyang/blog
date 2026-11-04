import packageJson from "../package.json" with { type: "json" };

if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  throw new Error("package.json 的 version 需要是语义化版本，例如 1.1.0");
}

export const siteVersion = packageJson.version;
