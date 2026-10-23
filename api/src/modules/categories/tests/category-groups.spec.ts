import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import { CategoriesService } from '../services/categories.service.js';
import { validateInput } from '../../../core/http/index.js';
import { CategoryDto } from '../dto/category.dto.js';
const db = new TestDatabase();
const categories = new CategoriesService(new CategoriesRepository(db.service));
const input = { name: 'Casa', type: 'expense', color: '#5ee9b5' };
let groupId: string, categoryId: string;
beforeAll(() => db.initialize());
afterAll(() => db.close());
describe('Owned category groups', () => {
  it('keeps existing flat categories and moves them without changing their identity', async () => {
    await db.forUser(db.user, async () => {
      const flat = await categories.save({ ...input, name: 'Luz' });
      categoryId = flat.id;
      expect((await categories.list())[0].groupId).toBe(
        (await categories.exportGroups()).find(
          (group) => group.isDefault && group.type === 'expense',
        )?.id,
      );
      groupId = (await categories.saveGroup(input)).id;
      await categories.update(flat.id, { ...input, name: 'Luz', groupId });
      expect((await categories.list())[0]).toMatchObject({
        id: flat.id,
        name: 'Luz',
        groupId,
        groupName: 'Casa',
      });
      await categories.update(flat.id, { ...input, name: 'Energia' });
      expect((await categories.list())[0].groupId).toBe(groupId);
    });
  });
  it('allows equal category names in separate groups and rejects duplicates in one group', async () => {
    await db.forUser(db.user, async () => {
      const other = (await categories.saveGroup({ ...input, name: 'Trabalho' })).id;
      await categories.save({ ...input, name: 'Energia', groupId: other });
    });
    await expect(
      db.forUser(db.user, () => categories.save({ ...input, name: 'Energia', groupId })),
    ).rejects.toThrow();
    expect(
      (await db.forUser(db.user, () => categories.list())).filter((c) => c.name === 'Energia'),
    ).toHaveLength(2);
  });
  it('rejects incompatible types, foreign ownership and same-owner cross-workspace references in service and database', async () => {
    await expect(
      db.forUser(db.user, () => categories.save({ ...input, type: 'income', groupId })),
    ).rejects.toThrow('Grupo incompatível');
    await expect(
      db.forUser(db.other, () => categories.save({ ...input, groupId })),
    ).rejects.toThrow('Grupo incompatível');
    const workspace = randomUUID();
    await db.engine.query("INSERT INTO wallet.workspaces(id,user_id,name) VALUES($1,$2,'Other')", [
      workspace,
      db.user,
    ]);
    await expect(
      db.forUser(db.user, () => categories.save({ ...input, groupId }), false, workspace),
    ).rejects.toThrow('Grupo incompatível');
    await expect(
      db.forUser(
        db.user,
        () =>
          db.service.query(
            'INSERT INTO wallet.categories(id,user_id,name,type,color,group_id) VALUES($1,$2,$3,$4,$5,$6)',
            [randomUUID(), db.user, 'Invalid', 'expense', input.color, groupId],
          ),
        false,
        workspace,
      ),
    ).rejects.toThrow();
    await expect(
      db.forUser(db.user, () => categories.saveGroup({ ...input, type: 'income' }, groupId)),
    ).rejects.toThrow('tipo do grupo');
    await expect(db.forUser(db.other, () => categories.update(categoryId, input))).rejects.toThrow(
      'não encontrada',
    );
  });
  it('validates names and routes explicit ungrouping into the default group', async () => {
    await expect(validateInput(CategoryDto, { ...input, name: '   ' })).rejects.toThrow();
    await db.forUser(db.user, async () => {
      await categories.update(categoryId, { ...input, name: 'Energia', groupId: null });
      expect((await categories.list()).find((c) => c.id === categoryId)?.groupId).toBe(
        (await categories.exportGroups()).find(
          (group) => group.isDefault && group.type === 'expense',
        )?.id,
      );
    });
  });
});

it('protects default groups through both service and SQL, including new workspaces', async () => {
  await db.forUser(db.user, async () => {
    const defaults = (await categories.exportGroups()).filter((group) => group.isDefault);
    expect(defaults).toHaveLength(2);
    await expect(categories.deletionPreview(defaults[0].id)).rejects.toThrow('padrão');
  });
  const id = (await db.forUser(db.user, () => categories.exportGroups())).find(
    (group) => group.isDefault,
  )!.id;
  await expect(db.forUser(db.user, () => categories.deleteGroup(id))).rejects.toThrow('padrão');
  await expect(
    db.forUser(db.user, () =>
      db.service.query('DELETE FROM wallet.category_groups WHERE id=$1', [id]),
    ),
  ).rejects.toThrow('protected');
  await expect(
    db.forUser(db.user, () =>
      db.service.query('UPDATE wallet.category_groups SET is_default=false WHERE id=$1', [id]),
    ),
  ).rejects.toThrow('protected');
  const workspace = randomUUID();
  await db.forUser(
    db.user,
    () =>
      db.service.query(
        "INSERT INTO wallet.workspaces(id,user_id,name) VALUES($1,$2,'Provisioned')",
        [workspace, db.user],
      ),
    false,
    null,
  );
  expect(
    (await db.forUser(db.user, () => categories.exportGroups(), true, workspace)).filter(
      (group) => group.isDefault,
    ),
  ).toHaveLength(2);
});
it('previews deletion and moves categories without changing their IDs or type', async () => {
  const group = await db.forUser(db.user, () =>
    categories.saveGroup({ ...input, name: 'Delete me' }),
  );
  const category = await db.forUser(db.user, () =>
    categories.save({ ...input, name: 'Water', groupId: group.id }),
  );
  const accountId = randomUUID(),
    transactionId = randomUUID();
  await db.forUser(db.user, async () => {
    await db.service.query(
      "INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_date,opening_balance_minor) VALUES($1,$2,'Account','mercado_pago','checking','2026-10-01',20000)",
      [accountId, db.user],
    );
    await db.service.query(
      "INSERT INTO wallet.transactions(id,user_id,account_id,category_id,transaction_date,description,amount_minor,transaction_type) VALUES($1,$2,$3,$4,'2026-10-23','Water',-500,'expense')",
      [transactionId, db.user, accountId, category.id],
    );
    const [plan] = await db.service.query(
      "INSERT INTO wallet.monthly_plans(user_id,month) VALUES($1,'2026-10-01') RETURNING id",
      [db.user],
    );
    await db.service.query(
      'INSERT INTO wallet.monthly_plan_lines(user_id,plan_id,category_id,amount_minor) VALUES($1,$2,$3,800)',
      [db.user, plan.id, category.id],
    );
    const archived = await categories.save({ ...input, name: 'Archived water', groupId: group.id });
    await db.service.query('UPDATE wallet.categories SET archived_at=now() WHERE id=$1', [
      archived.id,
    ]);
  });
  const preview = await db.forUser(db.user, () => categories.deletionPreview(group.id));
  expect(preview.categoryCount).toBe(2);
  expect(preview.conflictingNames).toEqual([]);
  await expect(db.forUser(db.other, () => categories.deleteGroup(group.id))).rejects.toThrow(
    'não encontrado',
  );
  const result = await db.forUser(db.user, () => categories.deleteGroup(group.id));
  expect(result.movedCategories).toBe(2);
  await db.forUser(db.user, async () => {
    const [transaction] = await db.service.query(
      'SELECT category_id,amount_minor FROM wallet.transactions WHERE id=$1',
      [transactionId],
    );
    const [line] = await db.service.query(
      'SELECT category_id,amount_minor FROM wallet.monthly_plan_lines WHERE category_id=$1',
      [category.id],
    );
    expect(transaction.category_id).toBe(category.id);
    expect(Number(transaction.amount_minor)).toBe(-500);
    expect(line.category_id).toBe(category.id);
    expect(Number(line.amount_minor)).toBe(800);
    expect(
      (await categories.list(true)).find((item) => item.name === 'Archived water')?.groupId,
    ).toBe(preview.destinationGroupId);
  });
  expect(
    (await db.forUser(db.user, () => categories.list())).find((item) => item.id === category.id),
  ).toMatchObject({ groupId: preview.destinationGroupId, name: 'Water', type: 'expense' });
  expect(
    (await db.forUser(db.user, () => categories.exportGroups())).some(
      (item) => item.id === group.id,
    ),
  ).toBe(false);
});
it('reports destination name collisions and rolls deletion back without merging categories', async () => {
  const group = await db.forUser(db.user, () =>
    categories.saveGroup({ ...input, name: 'Collision' }),
  );
  const category = await db.forUser(db.user, () =>
    categories.save({ ...input, name: 'Energia', groupId: group.id }),
  );
  const preview = await db.forUser(db.user, () => categories.deletionPreview(group.id));
  expect(preview.conflictingNames).toEqual(['Energia']);
  await expect(db.forUser(db.user, () => categories.deleteGroup(group.id))).rejects.toThrow(
    'mesmo nome',
  );
  expect(
    (await db.forUser(db.user, () => categories.list())).find((item) => item.id === category.id)
      ?.groupId,
  ).toBe(group.id);
  expect(
    (await db.forUser(db.user, () => categories.exportGroups())).some(
      (item) => item.id === group.id,
    ),
  ).toBe(true);
});

it('assigns a default group to legacy null-group SQL writes', async () => {
  await db.forUser(db.user, async () => {
    const rows = await db.service.query(
      "INSERT INTO wallet.categories(id,user_id,name,type,color) VALUES($1,$2,'Legacy client','expense','#5ee9b5') RETURNING group_id",
      [randomUUID(), db.user],
    );
    expect(rows[0].group_id).toBe(
      (await categories.exportGroups()).find(
        (group) => group.isDefault && group.type === 'expense',
      )!.id,
    );
  });
});
