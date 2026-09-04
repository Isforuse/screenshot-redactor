import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const electronRuntime = resolve(root, "node_modules", "electron", "dist");
const output = resolve(root, "release", "win-unpacked");
const appOutput = join(output, "resources", "app");

if (!existsSync(join(electronRuntime, "electron.exe"))) {
  console.error("Electron runtime is missing. Run `npm run postinstall:electron` first.");
  process.exit(1);
}

if (!existsSync(join(root, "dist", "index.html"))) {
  console.error("Vite build output is missing. Run `npm run build` first.");
  process.exit(1);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(appOutput, { recursive: true });

cpSync(electronRuntime, output, { recursive: true });
cpSync(join(output, "electron.exe"), join(output, "Screenshot Redactor.exe"));
rmSync(join(output, "electron.exe"), { force: true });

cpSync(join(root, "dist"), join(appOutput, "dist"), { recursive: true });
cpSync(join(root, "electron"), join(appOutput, "electron"), { recursive: true });
cpSync(join(root, "package.json"), join(appOutput, "package.json"));

console.log(`Packaged desktop app: ${join(output, "Screenshot Redactor.exe")}`);
