import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
it('preserves existing accounts and transactions in the default personal workspace', async () => {
  const db = new PGlite();
  const user = randomUUID();
  const account = randomUUID();
  const transaction = randomUUID();
  try {
    await db.exec('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);');
    await db.query('INSERT INTO auth.users VALUES($1)', [user]);
    await db.exec(readFileSync('supabase/migrations/202610220001_wallet.sql', 'utf8'));
    await db.query(
      "INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date) VALUES($1,$2,'Existing','other','checking',12345,'2026-01-01')",
      [account, user],
    );
    await db.query(
      "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type) VALUES($1,$2,$3,'2026-01-02','Existing movement',-345,'expense')",
      [transaction, user, account],
    );
    await db.exec(readFileSync('supabase/migrations/202610220002_workspaces.sql', 'utf8'));
    const space = (
      await db.query<{ id: string }>(
        'SELECT id FROM wallet.workspaces WHERE user_id=$1 AND is_default',
        [user],
      )
    ).rows[0];
    const a = (
      await db.query<{ workspace_id: string; opening_balance_minor: number }>(
        'SELECT workspace_id,opening_balance_minor FROM wallet.financial_accounts WHERE id=$1',
        [account],
      )
    ).rows[0];
    const t = (
      await db.query<{ workspace_id: string; amount_minor: number }>(
        'SELECT workspace_id,amount_minor FROM wallet.transactions WHERE id=$1',
        [transaction],
      )
    ).rows[0];
    expect(a.workspace_id).toBe(space.id);
    expect(t.workspace_id).toBe(space.id);
    expect(Number(a.opening_balance_minor) + Number(t.amount_minor)).toBe(12000);
  } finally {
    await db.close();
  }
});
