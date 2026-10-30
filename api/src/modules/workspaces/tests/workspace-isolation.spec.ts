import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestDatabase } from '../../../../test/database-harness.js';
import { WorkspacesService } from '../services/workspaces.service.js';
import { WorkspacesRepository } from '../repositories/workspaces.repository.js';
import { AccountsService } from '../../accounts/services/accounts.service.js';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { IdempotencyService } from '../../ledger/services/idempotency.service.js';
const db = new TestDatabase();
const spaces = new WorkspacesService(new WorkspacesRepository(db.service));
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const receipts = new IdempotencyService(db.service);
let personal: string;
let business: string;
let firstAccount: string;
beforeAll(async () => {
  await db.initialize();
  personal = (await db.forUser(db.user, () => spaces.list(), false, null))[0].id;
  business = (
    await db.forUser(
      db.user,
      () => spaces.create({ name: 'Business', description: 'Separate finances', color: 'blue' }),
      false,
      null,
    )
  ).id;
  firstAccount = (
    await db.forUser(
      db.user,
      () =>
        accounts.create({
          name: 'Main',
          institution: 'other',
          type: 'checking',
          openingBalance: 10000,
          openingDate: '2026-01-01',
        }),
      false,
      personal,
    )
  ).id;
});
afterAll(() => db.close());
describe('Private workspace boundary', () => {
  it('creates one default space and lists only spaces owned by the user', async () => {
    expect(await db.forUser(db.user, () => spaces.list(), false, null)).toHaveLength(2);
    expect(await db.forUser(db.user, () => spaces.list(), false, null)).toHaveLength(2);
    expect(await db.forUser(db.other, () => spaces.list(), false, null)).toHaveLength(1);
  });
  it('isolates balances and lookups between two spaces belonging to the same owner', async () => {
    expect(await db.forUser(db.user, () => accounts.list(), false, business)).toEqual([]);
    await expect(
      db.forUser(db.user, () => accounts.find(firstAccount), false, business),
    ).rejects.toThrow('não encontrada');
    expect((await db.forUser(db.user, () => accounts.list(), false, personal))[0].balance).toBe(
      10000,
    );
  });
  it('rejects selecting another user workspace and requires an explicit selection', async () => {
    await expect(db.forUser(db.other, () => accounts.list(), false, personal)).rejects.toThrow(
      'Espaço não encontrado',
    );
    await db.engine.exec('SET ROLE mywallet_runtime');
    try {
      await expect(db.service.forUser(db.user, () => accounts.list())).rejects.toThrow(
        'Selecione um espaço',
      );
    } finally {
      await db.engine.exec('RESET ROLE');
    }
  });
  it('allows identical categories and command keys in separate spaces', async () => {
    for (const id of [personal, business])
      await db.forUser(
        db.user,
        async () => {
          await categories.save({ name: 'Food', type: 'expense', color: '#5ee9b5' });
          const result = await receipts.execute(
            'test',
            'same-key',
            { workspace: id },
            async () => ({ workspace: id }),
          );
          expect(result.workspace).toBe(id);
        },
        false,
        id,
      );
  });
  it('rejects cross-space financial references even when the owner is identical', async () => {
    await expect(
      db.forUser(
        db.user,
        () =>
          db.service.query(
            'INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [randomUUID(), db.user, firstAccount, '2026-01-02', 'Wrong space', -100, 'expense'],
          ),
        false,
        business,
      ),
    ).rejects.toThrow();
  });
  it('does not expose financial rows in an owner-only, unselected context', async () => {
    expect(
      await db.forUser(
        db.user,
        () => db.service.query('SELECT id FROM wallet.financial_accounts'),
        false,
        null,
      ),
    ).toEqual([]);
  });
});

describe('Workspace trash and retention', () => {
  it('hides a trashed workspace, blocks reads/writes, preserves data and restores within seven days without extending retries', async () => {
    const archived = await db.forUser(db.user, () => spaces.archive(personal), false, null);
    expect(Date.parse(archived.deleteAfter) - Date.parse(archived.deletedAt)).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    const retried = await db.forUser(db.user, () => spaces.archive(personal), false, null);
    expect(retried.deletedAt).toBe(archived.deletedAt);
    const active = await db.forUser(db.user, () => spaces.list(), false, null);
    expect(active.some((space) => space.id === personal)).toBe(false);
    expect(active.find((space) => space.id === business)?.isDefault).toBe(true);
    for (const readOnly of [true, false])
      await expect(db.forUser(db.user, () => accounts.list(), readOnly, personal)).rejects.toThrow(
        'Espaço não encontrado',
      );
    // Even a caller retaining the old workspace setting cannot bypass the scoped RLS policy.
    await db.forUser(
      db.user,
      async () => {
        await db.service.query("SELECT set_config('wallet.workspace_id',$1,true)", [personal]);
        expect(await db.service.query('SELECT id FROM wallet.financial_accounts')).toEqual([]);
        await expect(
          db.service.query(
            "INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date) VALUES($1,$2,'Blocked','other','checking',0,'2026-01-01')",
            [randomUUID(), db.user],
          ),
        ).rejects.toThrow('row-level security');
      },
      false,
      null,
    );
    await expect(db.forUser(db.other, () => spaces.restore(personal), false, null)).rejects.toThrow(
      'Espaço não encontrado',
    );
    await db.forUser(db.user, () => spaces.restore(personal), false, null);
    expect(
      (await db.forUser(db.user, () => accounts.find(firstAccount), true, personal)).balance,
    ).toBe(10000);
    expect((await db.forUser(db.user, () => spaces.restore(personal), false, null)).id).toBe(
      personal,
    );
  });
  it('does not recreate the last trashed space and can create a new default while old data remains restorable', async () => {
    const otherDefault = (await db.forUser(db.other, () => spaces.list(), false, null))[0];
    await db.forUser(db.other, () => spaces.archive(otherDefault.id), false, null);
    expect(await db.forUser(db.other, () => spaces.list(), false, null)).toEqual([]);
    expect(await db.forUser(db.other, () => spaces.trash(), false, null)).toHaveLength(1);
    const newDefault = await db.forUser(
      db.other,
      () => spaces.create({ name: 'Fresh', description: '', color: 'emerald' }),
      false,
      null,
    );
    expect(newDefault.isDefault).toBe(true);
    await db.forUser(db.other, () => spaces.restore(otherDefault.id), false, null);
    expect(
      (await db.forUser(db.other, () => spaces.list(), false, null)).filter(
        (space) => space.isDefault,
      ),
    ).toHaveLength(1);
  });
  it('purges expired data atomically, protects unexpired/other-owner data and removes dependent financial audit/source/refund rows', async () => {
    await db.forUser(
      db.user,
      async () => {
        const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
        const [original, refund, batch, item] = ids;
        await db.service.query(
          "INSERT INTO wallet.import_batches(id,user_id,account_id,file_hash,file_name,mapper_version,opening_balance_minor,closing_balance_minor) VALUES($1,$2,$3,'retention','synthetic.pdf','test',0,0)",
          [batch, db.user, firstAccount],
        );
        await db.service.query(
          "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,import_batch_id) VALUES($1,$2,$3,'2026-10-01','Synthetic',-100,'expense',$4)",
          [original, db.user, firstAccount, batch],
        );
        await db.service.query(
          "INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type,refund_of_id) VALUES($1,$2,$3,'2026-10-02','Refund',100,'expense',$4)",
          [refund, db.user, firstAccount, original],
        );
        await db.service.query(
          "INSERT INTO wallet.import_items(id,user_id,batch_id,source_row,transaction_date,description,amount_minor,balance_after_minor,transaction_type,linked_transaction_id,refund_of_id) VALUES($1,$2,$3,1,'2026-10-01','Synthetic',-100,0,'expense',$4,$4)",
          [item, db.user, batch, original],
        );
        await db.service.query(
          "INSERT INTO wallet.transaction_sources(user_id,account_id,source_key,transaction_id,source_data) VALUES($1,$2,$3,$4,'{}')",
          [db.user, firstAccount, 'f'.repeat(64), original],
        );
        await db.service.query(
          "INSERT INTO wallet.account_balance_history(user_id,account_id,operation,previous_base_minor,new_base_minor,previous_basis,new_basis,reason) VALUES($1,$2,'manual',0,0,'{}','{}','Retention audit')",
          [db.user, firstAccount],
        );
      },
      false,
      personal,
    );
    const other = (await db.forUser(db.other, () => spaces.list(), false, null))[0];
    await db.forUser(db.other, () => spaces.archive(other.id), false, null);
    await db.forUser(db.user, () => spaces.archive(personal), false, null);
    await db.engine.query(
      "UPDATE wallet.workspaces SET deleted_at=now()-interval '169 hours' WHERE id=ANY($1::uuid[])",
      [[personal, other.id]],
    );
    await expect(db.forUser(db.user, () => spaces.restore(personal), false, null)).rejects.toThrow(
      'prazo',
    );
    await db.forUser(db.user, () => spaces.trash(), false, null);
    expect(
      (await db.engine.query('SELECT id FROM wallet.workspaces WHERE id=$1', [personal])).rows,
    ).toEqual([]);
    expect(
      (await db.engine.query('SELECT id FROM wallet.workspaces WHERE id=$1', [other.id])).rows,
    ).toHaveLength(1);
    for (const table of [
      'financial_accounts',
      'transactions',
      'import_batches',
      'import_items',
      'transaction_sources',
      'account_balance_history',
      'categories',
      'command_receipts',
    ])
      expect(
        (
          await db.engine.query(`SELECT workspace_id FROM wallet.${table} WHERE workspace_id=$1`, [
            personal,
          ])
        ).rows,
      ).toEqual([]);
    expect(
      (await db.engine.query('SELECT id FROM wallet.workspaces WHERE id=$1', [business])).rows,
    ).toHaveLength(1);
    await db.engine.query('SELECT wallet.purge_expired_workspaces()');
    expect(
      (await db.engine.query('SELECT id FROM wallet.workspaces WHERE id=$1', [other.id])).rows,
    ).toEqual([]);
    await expect(
      db.forUser(
        db.user,
        () => db.service.query('SELECT wallet.purge_expired_workspaces()'),
        false,
        null,
      ),
    ).rejects.toThrow('permission denied');
  });
});
