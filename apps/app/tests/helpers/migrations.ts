import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";

const helpersDir = dirname(fileURLToPath(import.meta.url));

const clickhouseMigrationsDir = resolve(
  helpersDir,
  "../../../../packages/clickhouse/migrations",
);

const postgresMigrationsDir = resolve(
  helpersDir,
  "../../../../packages/db/drizzle",
);

const splitStatements = (sql: string) =>
  sql
    .split(/^-- statement-breakpoint\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

const listSqlMigrations = async (dir: string) =>
  (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();

const readSqlMigration = (dir: string, file: string) =>
  readFile(resolve(dir, file), "utf8");

export {
  clickhouseMigrationsDir,
  listSqlMigrations,
  postgresMigrationsDir,
  readSqlMigration,
  splitStatements,
};
