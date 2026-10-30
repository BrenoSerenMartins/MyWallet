import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
import { BalanceBasisService } from '../services/balance-basis.service.js';
import { BalanceBasisRepository } from '../repositories/balance-basis.repository.js';
it('converts active old corrections without changing money and preserves reversed corrections in the append-only audit', async () => {
  const db = new TestDatabase();
  try {
    await db.initialize('202610260006_counterparty_external_identifiers.sql');
    // The current transaction guard locks workspace membership; the historical fixture predates that grant.
    await db.engine.exec('GRANT UPDATE(is_default) ON wallet.workspaces TO mywallet_runtime');
    const a = randomUUID(),
      purchase = randomUUID(),
      correction = randomUUID(),
      reversed = randomUUID();
    await db.forUser(db.user, async () => {
      await db.service.query(
        "INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date) VALUES($1,$2,'Legacy conversion','mercado_pago','checking',10000,'2026-01-01')",
        [a, db.user],
      );
      await db.service.query(
        "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type) VALUES($1,$2,$3,'2026-01-01','Real purchase',-1000,'expense')",
        [purchase, db.user, a],
      );
      await db.service.query(
        "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,balance_adjustment) VALUES($1,$2,$3,'2026-01-02','Old correction',2500,'transfer',$4)",
        [
          correction,
          db.user,
          a,
          JSON.stringify({
            previousBalance: 9000,
            targetBalance: 11500,
            reason: 'Old actual balance',
          }),
        ],
      );
      await db.service.query(
        "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,balance_adjustment,reversed_at) VALUES($1,$2,$3,'2026-01-03','Already undone',-1000,'transfer',$4,now())",
        [
          reversed,
          db.user,
          a,
          JSON.stringify({
            previousBalance: 11500,
            targetBalance: 10500,
            reason: 'Undone correction',
          }),
        ],
      );
    });
    await db.engine.exec(
      readFileSync('supabase/migrations/202610300001_account_balance_basis.sql', 'utf8'),
    );
    await db.forUser(db.user, async () => {
      const [state] = await db.service.query(
        'SELECT opening_balance_minor+(SELECT coalesce(sum(amount_minor),0) FROM wallet.transactions WHERE account_id=$1 AND reversed_at IS NULL) AS balance,opening_balance_minor FROM wallet.financial_accounts WHERE id=$1',
        [a],
      );
      expect(Number(state.balance)).toBe(11500);
      expect(Number(state.opening_balance_minor)).toBe(12500);
      const history = await new BalanceBasisService(new BalanceBasisRepository(db.service)).history(
        a,
      );
      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('legacy_conversion');
      expect(history[0].details.legacyCorrections).toHaveLength(2);
      expect(history[0].newBasis.referenceBalance).toBe(11500);
      expect(
        await db.service.query(
          'SELECT id FROM wallet.transactions WHERE account_id=$1 AND reversed_at IS NULL',
          [a],
        ),
      ).toHaveLength(1);
      expect(
        await db.service.query('SELECT id FROM wallet.transactions WHERE account_id=$1', [a]),
      ).toHaveLength(3);
    });
    // Emulate an old API instance still running between the two migrations.
    await db.forUser(db.user, () =>
      db.service.query(
        "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,balance_adjustment) VALUES(gen_random_uuid(),$1,$2,'2026-01-04','Rolling correction',50,'transfer',$3)",
        [
          db.user,
          a,
          JSON.stringify({
            previousBalance: 11500,
            targetBalance: 11550,
            reason: 'Old API during rollout',
          }),
        ],
      ),
    );
    await db.engine.exec(
      readFileSync(
        'supabase/migrations/202610300002_retire_ledger_balance_adjustments.sql',
        'utf8',
      ),
    );
    await db.forUser(db.user, async () => {
      const [row] = await db.service.query(
        'SELECT opening_balance_minor+(SELECT coalesce(sum(amount_minor),0) FROM wallet.transactions WHERE account_id=$1 AND reversed_at IS NULL) AS balance FROM wallet.financial_accounts WHERE id=$1',
        [a],
      );
      expect(Number(row.balance)).toBe(11550);
    });
    await expect(
      db.forUser(db.user, () =>
        db.service.query(
          "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,balance_adjustment) VALUES(gen_random_uuid(),$1,$2,'2026-01-05','Retired correction',1,'transfer',$3)",
          [
            db.user,
            a,
            JSON.stringify({
              previousBalance: 11550,
              targetBalance: 11551,
              reason: 'Must not create a financial correction',
            }),
          ],
        ),
      ),
    ).rejects.toThrow('balance_adjustments_retired');
    expect(
      await db.forUser(db.other, () =>
        new BalanceBasisService(new BalanceBasisRepository(db.service)).exportHistory(),
      ),
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
});
