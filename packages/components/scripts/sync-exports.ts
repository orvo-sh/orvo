import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(packageRoot, 'package.json');
const sourceIndexPath = path.join(packageRoot, 'src', 'index.ts');
const libIndexPath = path.join(packageRoot, 'src', 'lib', 'index.ts');
const hooksIndexPath = path.join(packageRoot, 'src', 'lib', 'hooks', 'index.ts');
const uiDir = path.join(packageRoot, 'src', 'lib', 'components', 'ui');
const iconsDir = path.join(packageRoot, 'src', 'lib', 'components', 'icons');
const hooksDir = path.join(packageRoot, 'src', 'lib', 'hooks');

const toEntry = (target: string) => ({
  types: target,
  svelte: target,
  default: target
});

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
  exports: Record<string, unknown>;
};
const uiDirents = await readdir(uiDir, { withFileTypes: true });
const iconDirents = await readdir(iconsDir, { withFileTypes: true });

const components = uiDirents
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort();
const icons = iconDirents
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort();
const hookEntries = await listHookEntries(hooksDir);

await rewriteLibImports(uiDir);
await rewriteLibImports(iconsDir);

packageJson.exports = {
  '.': toEntry('./src/index.ts'),
  './utils': toEntry('./src/lib/utils.ts'),
  './hooks': toEntry('./src/lib/hooks/index.ts'),
  './styles.css': './src/lib/styles.css'
};

for (const icon of icons) {
  packageJson.exports[`./icons/${icon}`] = toEntry(`./src/lib/components/icons/${icon}/index.ts`);
}

for (const component of components) {
  packageJson.exports[`./ui/${component}`] = toEntry(
    `./src/lib/components/ui/${component}/index.ts`
  );
}

const sourceIndex = [
  'export * from "./lib/utils.js";',
  'export * from "./lib/hooks/index.js";',
  ...icons.map(
    (icon) => `export * as ${toPascalCase(icon)} from "./lib/components/icons/${icon}/index.js";`
  ),
  ...components.map(
    (component) =>
      `export * as ${toPascalCase(component)} from "./lib/components/ui/${component}/index.js";`
  ),
  ''
].join('\n');

const libIndex = [
  'export * from "./utils.js";',
  'export * from "./hooks/index.js";',
  ...icons.map(
    (icon) => `export * as ${toPascalCase(icon)} from "./components/icons/${icon}/index.js";`
  ),
  ...components.map(
    (component) =>
      `export * as ${toPascalCase(component)} from "./components/ui/${component}/index.js";`
  ),
  ''
].join('\n');

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(sourceIndexPath, sourceIndex);
await writeFile(libIndexPath, libIndex);
await writeFile(
  hooksIndexPath,
  [...hookEntries.map((hookEntry) => `export * from "./${hookEntry.modulePath}";`), ''].join('\n')
);

function toPascalCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}

async function rewriteLibImports(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filepath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await rewriteLibImports(filepath);
      continue;
    }

    if (!/\.(svelte|ts|js)$/.test(entry.name)) {
      continue;
    }

    const file = await readFile(filepath, 'utf8');
    const rewritten = file.replaceAll(/from "\$lib\/([^"]+)"/g, (_match, target) => {
      const relativePath = path.relative(
        path.dirname(filepath),
        path.join(packageRoot, 'src', 'lib', target)
      );
      const normalizedPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

      return `from "${normalizedPath.replaceAll(path.sep, '/')}"`;
    });

    if (rewritten !== file) {
      await writeFile(filepath, rewritten);
    }
  }
}

async function listHookEntries(directory: string, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const hooks: Array<{ importPath: string; modulePath: string }> = [];

  for (const entry of entries) {
    if (entry.name === 'index.ts') {
      continue;
    }

    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;
    const filepath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      hooks.push(...(await listHookEntries(filepath, relativePath)));
      continue;
    }

    if (!/\.(?:svelte\.)?(?:ts|js)$/.test(entry.name)) {
      continue;
    }

    const importPath = relativePath.replace(/\.(?:svelte\.)?(?:ts|js)$/, '');
    const modulePath = entry.name.includes('.svelte.')
      ? `${importPath}.svelte.js`
      : `${importPath}.js`;
    hooks.push({ importPath, modulePath });
  }

  return hooks.sort((left, right) => left.importPath.localeCompare(right.importPath));
}
