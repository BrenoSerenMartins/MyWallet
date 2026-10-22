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
