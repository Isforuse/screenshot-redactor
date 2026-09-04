import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceRoots = ["src", "tests"];
const riskyPatterns = [
  { name: "dangerous-html", pattern: /dangerouslySetInnerHTML/ },
  { name: "eval", pattern: /\beval\s*\(/ },
  { name: "function-constructor", pattern: /new Function\s*\(/ },
  { name: "remote-upload", pattern: /\bfetch\s*\(|XMLHttpRequest|axios\./ },
  { name: "persistent-sensitive-storage", pattern: /localStorage|indexedDB|sessionStorage/ }
];

function filesUnder(dir) {
  const full = join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const path = join(full, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return filesUnder(join(dir, entry));
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry) ? [path] : [];
  });
}

const findings = [];

for (const file of sourceRoots.flatMap(filesUnder)) {
  const content = readFileSync(file, "utf8");
  for (const check of riskyPatterns) {
    if (check.pattern.test(content)) {
      findings.push(`${check.name}: ${file}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security check passed.");
