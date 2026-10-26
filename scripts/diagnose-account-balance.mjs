import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
function accountFilter() {
  const accountId = process.argv.find((value) => value.startsWith('--account='))?.slice(10);
  if (
    accountId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)
  )
    return { sql: 'id=$1', value: accountId };
  const balance = process.argv.find((value) => value.startsWith('--balance='))?.slice(10);
  if (!accountId && balance && /^-?\d{1,12}\.\d{2}$/.test(balance)) {
    const minor = Number(balance.replace('.', ''));
    if (Number.isSafeInteger(minor)) return { sql: 'balance=$1', value: minor };
  }
  throw new Error('Use --account=<uuid> or --balance=703.31 to select the account to inspect.');
}
async function connectionSettings() {
  let url;
  try {
    if (!process.env.SUPABASE_DB_PASSWORD) throw new Error('No pooler password');
    url = new URL((await readFile('supabase/.temp/pooler-url', 'utf8')).trim());
    url.password = process.env.SUPABASE_DB_PASSWORD;
  } catch {
    url = new URL(process.env.DATABASE_URL);
  }
  return {
    connectionString: url.href,
    max: 1,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(
        process.env.DATABASE_CA_FILE || 'infra/certificates/supabase-root-2021.crt',
        'utf8',
      ),
    },
  };
}
async function accountSummary(client, filter) {
  const result = await client.query(
    `WITH totals AS (
      SELECT a.id,a.opening_date,a.opening_balance_minor,
      a.opening_balance_minor+coalesce(sum(t.amount_minor),0) AS balance,
      count(t.id) AS active_movements,
      coalesce(sum(t.amount_minor) FILTER(WHERE t.import_batch_id IS NULL),0) AS manual_net,
      coalesce(sum(t.amount_minor) FILTER(WHERE t.import_batch_id IS NOT NULL),0) AS imported_net,
      coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_type='transfer'),0) AS transfer_net,
      max(t.transaction_date) AS last_movement_date
      FROM wallet.financial_accounts a LEFT JOIN wallet.transactions t ON t.account_id=a.id AND t.user_id=a.user_id AND t.reversed_at IS NULL
      WHERE a.institution='mercado_pago' GROUP BY a.id
    ) SELECT * FROM totals WHERE ${filter.sql} ORDER BY id LIMIT 10`,
    [filter.value],
  );
  return result.rows;
}
async function statementChecks(client, accountId) {
  const result = await client.query(
    `SELECT b.id AS import_id,b.closing_balance_minor AS source_closing,
      min(i.transaction_date) AS first_date,max(i.transaction_date) AS last_date,count(i.id) AS source_movements,
      (SELECT count(*) FROM wallet.transactions t WHERE t.import_batch_id=b.id AND t.reversed_at IS NULL) AS active_from_import,
      a.opening_balance_minor+(SELECT coalesce(sum(t.amount_minor),0) FROM wallet.transactions t WHERE t.account_id=a.id AND t.user_id=a.user_id AND t.reversed_at IS NULL AND t.transaction_date<=max(i.transaction_date)) AS recorded_at_end_of_day
      FROM wallet.import_batches b JOIN wallet.import_items i ON i.batch_id=b.id
      JOIN wallet.financial_accounts a ON a.id=b.account_id
      WHERE b.account_id=$1 AND b.report_type='account_statement' AND b.status='confirmed'
      GROUP BY b.id,a.id ORDER BY max(i.transaction_date) DESC,b.created_at DESC LIMIT 5`,
    [accountId],
  );
  return result.rows;
}
async function sourceChecks(client, accountId) {
  const duplicates = await client.query(
    `WITH copies AS (
      SELECT count(*) AS occurrences,i.amount_minor FROM wallet.transactions t
      JOIN wallet.import_items i ON i.batch_id=t.import_batch_id AND i.source_row=t.source_row
      WHERE t.account_id=$1 AND t.reversed_at IS NULL AND i.source_operation_id IS NOT NULL AND i.balance_after_minor IS NOT NULL
      GROUP BY i.transaction_date,i.amount_minor,i.source_operation_id,i.balance_after_minor HAVING count(*)>1
    ) SELECT count(*) AS repeated_source_groups,coalesce(sum(occurrences-1),0) AS extra_occurrences,
      coalesce(sum((occurrences-1)*amount_minor),0) AS extra_source_net FROM copies`,
    [accountId],
  );
  const edits = await client.query(
    `SELECT count(*) AS edited_imported_movements,coalesce(sum(t.amount_minor-i.amount_minor),0) AS edit_net_difference
      FROM wallet.transactions t JOIN wallet.import_items i ON i.batch_id=t.import_batch_id AND i.source_row=t.source_row
      WHERE t.account_id=$1 AND t.reversed_at IS NULL AND (t.amount_minor<>i.amount_minor OR t.transaction_date<>i.transaction_date)`,
    [accountId],
  );
  return { ...duplicates.rows[0], ...edits.rows[0] };
}
async function diagnose() {
  const filter = accountFilter();
  const pool = new Pool(await connectionSettings());
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='15s'");
    const accounts = await accountSummary(client, filter);
    console.log(
      'Read-only balance diagnosis. Monetary values are integer cents; no account data is changed.',
    );
    if (!accounts.length) console.log('No Mercado Pago account matches the supplied filter.');
    for (const account of accounts)
      console.log(
        JSON.stringify(
          {
            account,
            statements: await statementChecks(client, account.id),
            sourceChecks: await sourceChecks(client, account.id),
          },
          null,
          2,
        ),
      );
    console.log(
      'Statement comparisons use end-of-day ledger totals. Later same-day movements and partial imports may differ from a file cutoff; differences are evidence, not automatic corrections.',
    );
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    await pool.end();
  }
}
try {
  await diagnose();
} catch (error) {
  console.error(
    'Balance diagnosis failed:',
    error.code ?? (error.message.startsWith('Use --') ? error.message : error.name),
  );
  process.exitCode = 1;
}
