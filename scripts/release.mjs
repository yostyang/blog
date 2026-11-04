import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const level = process.argv[2];
const note = process.argv
  .slice(3)
  .join(" ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/^[-*]\s+/, "");

if (!["patch", "minor", "major"].includes(level) || !note) {
  console.error('用法: npm run release -- patch|minor|major "说明"');
  process.exit(1);
}

const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const changelogPath = path.join(root, "CHANGELOG.md");

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const current = packageJson.version;
if (typeof current !== "string" || !/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`无法解析 package.json 的版本号 ${current}`);
  process.exit(1);
}

const next = bump(current, level);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

replaceOnce(
  packagePath,
  /("version": ")(\d+\.\d+\.\d+)(")/,
  `$1${next}$3`,
  "package.json",
);
replaceOnce(
  lockPath,
  /("name": "yost-blog",\n\s+"version": ")(\d+\.\d+\.\d+)(")/,
  `$1${next}$3`,
  "package-lock.json",
);

const changelog = fs.readFileSync(changelogPath, "utf8");
if (changelog.includes(`## [${next}]`)) {
  console.error(`CHANGELOG.md 已经有 ${next}`);
  process.exit(1);
}
const marker = changelog.indexOf("\n## [");
if (marker < 0) {
  console.error("CHANGELOG.md 没有版本条目");
  process.exit(1);
}
const entry = `\n## [${next}] - ${today}\n\n### 变更\n\n- ${note}\n`;
fs.writeFileSync(changelogPath, changelog.slice(0, marker) + entry + changelog.slice(marker));

console.log(`${current} → ${next}`);
console.log(`已写入 package.json、package-lock.json 和 CHANGELOG.md。`);
console.log(`合并到 main 之后，在合并提交上打标签 v${next}，并发布 GitHub Release。`);

function bump(version, which) {
  let [major, minor, patch] = version.split(".").map(Number);
  if (which === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (which === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function replaceOnce(file, pattern, replacement, label) {
  const text = fs.readFileSync(file, "utf8");
  const match = pattern.exec(text);
  if (!match) {
    console.error(`${label} 里找不到当前版本号`);
    process.exit(1);
  }
  fs.writeFileSync(file, text.replace(pattern, replacement));
}
