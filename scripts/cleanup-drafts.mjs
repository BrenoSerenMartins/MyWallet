import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('Administrative DATABASE_URL is required.');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(
      process.env.DATABASE_CA_FILE || 'infra/certificates/supabase-root-2021.crt',
      'utf8',
    ),
  },
});
try {
  const result = await pool.query(
    "DELETE FROM wallet.import_batches WHERE status='draft' AND history_saved_at IS NULL AND expires_at<now() RETURNING id",
  );
  const restores = await pool.query(
    "DELETE FROM wallet.restore_batches WHERE status='draft' AND expires_at<now() RETURNING id",
  );
  console.log(
    'Removed expired drafts:',
    result.rowCount,
    'imports;',
    restores.rowCount,
    'restores.',
  );
} finally {
  await pool.end();
}
