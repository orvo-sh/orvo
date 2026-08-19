import { Session } from 'chdb';
import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const sqlString = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;

const applyQueryParameters = (sql, searchParams) =>
  sql.replace(/\{([A-Za-z_][A-Za-z0-9_]*):([^}]+)\}/g, (placeholder, name, type) => {
    const value = searchParams.get(`param_${name}`);
    if (value === null) return placeholder;

    if (/^(?:U?Int\d+|Float\d+|Decimal(?:\(.+\))?|Bool)$/.test(type)) {
      return value;
    }

    if (type.startsWith('Array(') || type.startsWith('Tuple(')) {
      return value;
    }

    return sqlString(value);
  });

const applyChDBCompatibility = (sql) => sql.replaceAll('lowerUTF8(', 'lower(');

const startChDB = async ({ dataDir, migrationsDir, port }) => {
  const session = new Session(dataDir);
  session.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version String,
      name String,
      applied_at DateTime DEFAULT now()
    ) ENGINE = MergeTree ORDER BY version
  `);

  for (const name of (await readdir(migrationsDir))
    .filter((entry) => !entry.startsWith('._') && entry.endsWith('.sql'))
    .sort()) {
    const version = name.replace(/\.sql$/, '');
    const found = session.query(
      `SELECT count() FROM schema_migrations WHERE version = ${sqlString(version)}`,
      'CSV'
    );
    if (Number(found.trim()) > 0) continue;

    session.query(await readFile(path.join(migrationsDir, name), 'utf8'));
    session.query(
      `INSERT INTO schema_migrations (version, name) VALUES (${sqlString(version)}, ${sqlString(name)})`
    );
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const body = await readBody(request);
    const query = url.searchParams.get('query');
    const sql = applyChDBCompatibility(
      applyQueryParameters(
        query
          ? `${query}${body.length > 0 ? `\n${body.toString('utf8')}` : ''}`
          : body.toString('utf8'),
        url.searchParams
      )
    );

    if (!sql.trim()) {
      response.writeHead(200).end('Ok.\n');
      return;
    }

    try {
      const result = await session.queryAsync(sql);
      response.setHeader('content-type', 'application/octet-stream');
      response.setHeader('x-clickhouse-query-id', url.searchParams.get('query_id') ?? randomUUID());
      response.writeHead(200).end(Buffer.from(result.bytes()));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    close: async () => {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      session.close();
    }
  };
};

export { startChDB };
