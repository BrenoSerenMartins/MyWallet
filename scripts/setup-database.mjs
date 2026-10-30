import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
const envPath = '.env.local';
const env = await readFile(envPath, 'utf8');
const entries = Object.fromEntries(
  env
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const split = line.indexOf('=');
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
let url;
try {
  url = new URL((await readFile('supabase/.temp/pooler-url', 'utf8')).trim());
  url.password = entries.SUPABASE_DB_PASSWORD;
} catch {
  url = new URL(entries.DATABASE_URL);
}
const config = {
  connectionString: url.href,
  connectionTimeoutMillis: 10000,
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(
      entries.DATABASE_CA_FILE || 'infra/certificates/supabase-root-2021.crt',
      'utf8',
    ),
  },
};
const check = new Pool(config);
try {
  await check.query('SELECT 1');
} catch (error) {
  console.error('Database setup could not connect:', error.code ?? error.name);
  process.exitCode = 1;
  await check.end();
  process.exit();
}
await check.end();
const migrated = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.href },
});
if (migrated.status !== 0) process.exit(migrated.status ?? 1);
const admin = new Pool(config);
const password = entries.RUNTIME_DATABASE_URL
  ? new URL(entries.RUNTIME_DATABASE_URL).password
  : randomBytes(32).toString('hex');
if (!/^[a-zA-Z0-9_-]{20,}$/.test(password))
  throw new Error('Existing runtime password needs manual review.');
try {
  const result = await admin.query(
    "SELECT rolcanlogin FROM pg_roles WHERE rolname='mywallet_runtime'",
  );
  if (result.rows[0]?.rolcanlogin && !entries.RUNTIME_DATABASE_URL)
    throw new Error(
      'Runtime role already has a password. Supply its existing RUNTIME_DATABASE_URL instead of rotating it.',
    );
  if (!result.rows[0]?.rolcanlogin) {
    const recovery = new URL(url);
    recovery.username = url.hostname.includes('.pooler.')
      ? 'mywallet_runtime.' + entries.SUPABASE_PROJECT_REF
      : 'mywallet_runtime';
    recovery.password = password;
    entries.RUNTIME_DATABASE_URL = recovery.href;
    await writeFile(
      envPath,
      Object.entries(entries)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    );
    await admin.query(`ALTER ROLE mywallet_runtime LOGIN PASSWORD '${password}'`);
  }
  const runtime = new URL(url);
  runtime.username = url.hostname.includes('.pooler.')
    ? 'mywallet_runtime.' + entries.SUPABASE_PROJECT_REF
    : 'mywallet_runtime';
  runtime.password = password;
  const runtimePool = new Pool({ ...config, connectionString: runtime.href });
  try {
    const result = await runtimePool.query('SELECT current_user');
    if (result.rows[0].current_user !== 'mywallet_runtime')
      throw new Error('Unexpected runtime role.');
  } finally {
    await runtimePool.end();
  }
  entries.RUNTIME_DATABASE_URL = runtime.href;
  await writeFile(
    envPath,
    Object.entries(entries)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  await chmod(envPath, 0o600);
  const cronInstalled = await admin.query("SELECT 1 FROM pg_extension WHERE extname='pg_cron'");
  if (cronInstalled.rows.length) {
    const job = await admin.query(
      "SELECT schedule,active FROM cron.job WHERE jobname='mywallet-workspace-retention'",
    );
    if (!job.rows.some((row) => row.active && row.schedule === '*/10 * * * *'))
      throw new Error('Workspace retention job is not active.');
    console.log(
      'Workspace trash retention: automatic purge scheduled every 10 minutes after the 7-day deadline.',
    );
  } else {
    console.log(
      'pg_cron is unavailable: expired workspaces are purged on workspace-list access. Enable Supabase Cron for cleanup without app access.',
    );
  }
  console.log(
    'Migrations and restricted runtime role configured. Restart the API to load local settings.',
  );
} finally {
  await admin.end();
}
