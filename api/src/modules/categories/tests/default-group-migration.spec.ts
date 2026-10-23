import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { it, expect } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
it('backfills default groups without renaming an existing Geral group or changing category identity', async () => {
  const db = new TestDatabase();
  try {
    await db.initialize('202610230004_category_groups.sql');
    const workspace = (
      await db.engine.query<{ id: string }>(
        'SELECT id FROM wallet.workspaces WHERE user_id=$1 AND is_default',
        [db.user],
      )
    ).rows[0].id;
    const group = randomUUID(),
      flat = randomUUID(),
      grouped = randomUUID();
    await db.engine.query(
      "INSERT INTO wallet.category_groups(id,user_id,workspace_id,name,type,color) VALUES($1,$2,$3,'Geral','expense','#5ee9b5')",
      [group, db.user, workspace],
    );
    for (const [id, groupId] of [
      [flat, null],
      [grouped, group],
    ])
      await db.engine.query(
        "INSERT INTO wallet.categories(id,user_id,workspace_id,name,type,color,group_id) VALUES($1,$2,$3,'Water','expense','#5ee9b5',$4)",
        [id, db.user, workspace, groupId],
      );
    await db.engine.exec(
      readFileSync('supabase/migrations/202610230005_default_category_groups.sql', 'utf8'),
    );
    const defaults = (
      await db.engine.query<{ id: string; name: string; type: string }>(
        'SELECT id,name,type FROM wallet.category_groups WHERE user_id=$1 AND workspace_id=$2 AND is_default',
        [db.user, workspace],
      )
    ).rows;
    expect(defaults).toHaveLength(2);
    expect(defaults.find((group) => group.type === 'expense')?.name).toBe('Geral (padrão)');
    const rows = (
      await db.engine.query<{ id: string; group_id: string }>(
        'SELECT id,group_id FROM wallet.categories WHERE user_id=$1',
        [db.user],
      )
    ).rows;
    expect(rows.find((category) => category.id === flat)?.group_id).toBe(
      defaults.find((group) => group.type === 'expense')!.id,
    );
    expect(rows.find((category) => category.id === grouped)?.group_id).toBe(group);
  } finally {
    await db.close();
  }
});
