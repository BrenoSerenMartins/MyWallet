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
      expect((await categories.list())[0].groupId).toBeNull();
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
            'INSERT INTO wallet.categories(user_id,name,type,color,group_id) VALUES($1,$2,$3,$4,$5)',
            [db.user, 'Invalid', 'expense', input.color, groupId],
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
  it('validates names and supports explicit ungrouping', async () => {
    await expect(validateInput(CategoryDto, { ...input, name: '   ' })).rejects.toThrow();
    await db.forUser(db.user, async () => {
      await categories.update(categoryId, { ...input, name: 'Energia', groupId: null });
      expect((await categories.list()).find((c) => c.id === categoryId)?.groupId).toBeNull();
    });
  });
});
