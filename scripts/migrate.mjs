import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required for administrative migrations.');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(
      process.env.DATABASE_CA_FILE || 'infra/certificates/supabase-root-2021.crt',
      'utf8',
    ),
  },
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(717240188)');
  await client.query('CREATE SCHEMA IF NOT EXISTS mywallet_migrations');
  await client.query(
    'CREATE TABLE IF NOT EXISTS mywallet_migrations.applied(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    if (
      (
        await client.query('SELECT version FROM mywallet_migrations.applied WHERE version=$1', [
          file,
        ])
      ).rowCount
    )
      continue;
    const sql = await readFile('supabase/migrations/' + file, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
      await client.query('INSERT INTO mywallet_migrations.applied(version) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log('Applied', file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(717240188)').catch(() => {});
  client.release();
  await pool.end();
}
