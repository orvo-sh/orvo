import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(packageRoot, "package.json");
const sourceIndexPath = path.join(packageRoot, "src", "index.ts");
const libIndexPath = path.join(packageRoot, "src", "lib", "index.ts");
const hooksIndexPath = path.join(packageRoot, "src", "lib", "hooks", "index.ts");
const uiDir = path.join(packageRoot, "src", "lib", "components", "ui");

const toEntry = (target) => ({
  types: target,
  svelte: target,
  default: target,
});

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const dirents = await readdir(uiDir, { withFileTypes: true });

const components = dirents
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort();

packageJson.exports = {
  ".": toEntry("./src/index.ts"),
  "./utils": toEntry("./src/lib/utils.ts"),
  "./hooks": toEntry("./src/lib/hooks/index.ts"),
  "./styles.css": "./src/lib/styles.css",
};

for (const component of components) {
  packageJson.exports[`./ui/${component}`] = toEntry(
    `./src/lib/components/ui/${component}/index.ts`,
  );
}

const sourceIndex = [
  'export * from "./lib/utils.js";',
  'export * from "./lib/hooks/index.js";',
  ...components.map(
    (component) =>
      `export * as ${toPascalCase(component)} from "./lib/components/ui/${component}/index.js";`,
  ),
  "",
].join("\n");

const libIndex = [
  'export * from "./utils.js";',
  'export * from "./hooks/index.js";',
  ...components.map(
    (component) =>
      `export * as ${toPascalCase(component)} from "./components/ui/${component}/index.js";`,
  ),
  "",
].join("\n");

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(sourceIndexPath, sourceIndex);
await writeFile(libIndexPath, libIndex);
await writeFile(hooksIndexPath, "export {};\n");

function toPascalCase(value) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}
