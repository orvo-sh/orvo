import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(packageRoot, 'migrations');
const name = process.argv[2]?.trim();

if (!name) {
  console.error('Usage: pnpm --filter @repo/clickhouse run db:create-migration <name>');
  process.exit(1);
}

await mkdir(migrationsDir, { recursive: true });

const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const timestamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14);
const filename = `${timestamp}_${slug}.sql`;
const filepath = path.join(migrationsDir, filename);

await writeFile(
  filepath,
  [
    '-- Use `-- statement-breakpoint` between statements when a migration contains multiple commands.',
    '',
    ''
  ].join('\n')
);

console.log(path.relative(packageRoot, filepath));
