import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectorVersion,
  installerPublishPath,
  manifestPublishPath,
  renderInstaller
} from '../src/index.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const distDir = path.join(packageRoot, 'dist');

const ensureDir = async (targetPath: string) => {
  await mkdir(path.dirname(targetPath), { recursive: true });
};

const writeManifest = async () => {
  const manifestPath = path.join(distDir, manifestPublishPath);
  await ensureDir(manifestPath);
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        collectorVersion,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n'
  );
};

const writeInstaller = async () => {
  const sourcePath = path.join(packageRoot, 'assets', 'install.sh');
  const installerPath = path.join(distDir, installerPublishPath);
  const source = await readFile(sourcePath, 'utf8');
  const rendered = renderInstaller(source);

  await ensureDir(installerPath);
  await writeFile(installerPath, rendered, { mode: 0o755 });
};

const copyTemplates = async () => {
  const sourceDir = path.join(packageRoot, 'templates');
  const targetDir = path.join(distDir, 'templates');
  await mkdir(targetDir, { recursive: true });

  await Promise.all([
    copyFile(
      path.join(sourceDir, 'otelcol-config.yaml.tmpl'),
      path.join(targetDir, 'otelcol-config.yaml.tmpl')
    ),
    copyFile(
      path.join(sourceDir, 'orvo-host-agent.env.tmpl'),
      path.join(targetDir, 'orvo-host-agent.env.tmpl')
    ),
    copyFile(
      path.join(sourceDir, 'orvo-host-agent.service.tmpl'),
      path.join(targetDir, 'orvo-host-agent.service.tmpl')
    )
  ]);
};

await mkdir(distDir, { recursive: true });
await Promise.all([writeInstaller(), writeManifest(), copyTemplates()]);
