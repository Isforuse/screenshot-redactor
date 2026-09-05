import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
cpSync(join(root, "assets"), join(appOutput, "assets"), { recursive: true });
cpSync(join(root, "package.json"), join(appOutput, "package.json"));

const lockfile = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const runtimeModules = new Set();

function collectRuntimeModule(moduleName) {
  if (runtimeModules.has(moduleName)) return;
  const packagePath = `node_modules/${moduleName}`;
  const packageInfo = lockfile.packages?.[packagePath];
  if (!packageInfo) {
    throw new Error(`Missing package-lock entry for ${moduleName}`);
  }

  runtimeModules.add(moduleName);
  for (const dependencyName of Object.keys(packageInfo.dependencies ?? {})) {
    collectRuntimeModule(dependencyName);
  }
}

collectRuntimeModule("tesseract.js");

mkdirSync(join(appOutput, "node_modules"), { recursive: true });
for (const moduleName of runtimeModules) {
  cpSync(join(root, "node_modules", moduleName), join(appOutput, "node_modules", moduleName), { recursive: true });
}

console.log(`Packaged desktop app: ${join(output, "Screenshot Redactor.exe")}`);
