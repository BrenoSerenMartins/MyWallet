import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
it('renames the historical role and migration ledger without replaying migrations or losing ownership/RLS', async () => {
  const db = new TestDatabase();
  try {
    await db.initialize('202611010002_cards_investments_wealth.sql');
    const accountId = randomUUID();
    await db.forUser(db.user, () =>
      db.service.query(
        "INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date) VALUES($1,$2,'Identity fixture','alelo','benefit_food',15000,'2026-11-01')",
        [accountId, db.user],
      ),
    );
    await db.engine.exec(
      "ALTER ROLE plannedwallet_runtime RENAME TO mywallet_runtime; CREATE SCHEMA mywallet_migrations; CREATE TABLE mywallet_migrations.applied(version text PRIMARY KEY); INSERT INTO mywallet_migrations.applied VALUES('already-applied.sql');",
    );
    const before = await db.engine.query<{ oid: number }>(
      "SELECT oid FROM pg_roles WHERE rolname='mywallet_runtime'",
    );
    const migration = readFileSync(
      'supabase/migrations/202611040001_plannedwallet_identity.sql',
      'utf8',
    );
    await db.engine.exec(migration);
    await db.engine.exec(migration);
    const after = await db.engine.query<{ oid: number; rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT oid,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='plannedwallet_runtime'",
    );
    expect(after.rows[0]).toEqual({
      oid: before.rows[0].oid,
      rolsuper: false,
      rolbypassrls: false,
    });
    expect(
      (await db.engine.query('SELECT version FROM plannedwallet_migrations.applied')).rows,
    ).toEqual([{ version: 'already-applied.sql' }]);
    await db.forUser(db.user, async () => {
      const [account] = await db.service.query(
        'SELECT opening_balance_minor FROM wallet.financial_accounts WHERE id=$1',
        [accountId],
      );
      expect(Number(account.opening_balance_minor)).toBe(15000);
    });
    await db.forUser(db.other, async () => {
      expect(
        await db.service.query('SELECT id FROM wallet.financial_accounts WHERE id=$1', [accountId]),
      ).toEqual([]);
    });
  } finally {
    await db.close();
  }
});
