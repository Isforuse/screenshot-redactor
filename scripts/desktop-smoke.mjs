import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const expected = [
  join("dist", "index.html"),
  join("electron", "main.cjs"),
  join("electron", "preload.cjs"),
  join("release", "win-unpacked", "Screenshot Redactor.exe")
];

const missing = expected.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error("Desktop smoke check failed. Missing files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const exe = join("release", "win-unpacked", "Screenshot Redactor.exe");
const size = statSync(exe).size;

if (size < 1_000_000) {
  console.error(`Desktop smoke check failed. EXE is unexpectedly small: ${size} bytes`);
  process.exit(1);
}

console.log(`Desktop smoke check passed. EXE size: ${size} bytes`);
