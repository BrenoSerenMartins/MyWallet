import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import type { BackupMonthlyPlan } from '../../../core/integration/index.js';
export interface SavedMonthlyPlan extends BackupMonthlyPlan {
  id: string;
  version: number;
}
@Injectable()
export class PlanningRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async lock(month: string) {
    await this.db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || wallet.current_workspace_id()::text,0))",
      [`${this.db.userId}:planning:${month}`],
    );
  }
  async find(month: string): Promise<SavedMonthlyPlan | null> {
    const [row] = await this.db.query(
      'SELECT id,month::text,contribution_minor,notes,version FROM wallet.monthly_plans WHERE user_id=$1 AND month=$2',
      [this.db.userId, `${month}-01`],
    );
    if (!row) return null;
    const lines = await this.db.query(
      'SELECT category_id,amount_minor FROM wallet.monthly_plan_lines WHERE user_id=$1 AND plan_id=$2 ORDER BY category_id',
      [this.db.userId, row.id],
    );
    return {
      id: row.id,
      month,
      version: row.version,
      notes: row.notes,
      contribution: row.contribution_minor === null ? null : Number(row.contribution_minor),
      lines: lines.map((l) => ({ categoryId: l.category_id, amount: Number(l.amount_minor) })),
    };
  }
  async save(plan: BackupMonthlyPlan) {
    const [row] = await this.db.query(
      `INSERT INTO wallet.monthly_plans(user_id,month,contribution_minor,notes) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id,workspace_id,month) DO UPDATE SET contribution_minor=EXCLUDED.contribution_minor,notes=EXCLUDED.notes,version=monthly_plans.version+1,updated_at=now() RETURNING id`,
      [this.db.userId, `${plan.month}-01`, plan.contribution, plan.notes],
    );
    await this.db.query('DELETE FROM wallet.monthly_plan_lines WHERE user_id=$1 AND plan_id=$2', [
      this.db.userId,
      row.id,
    ]);
    for (const line of plan.lines)
      await this.db.query(
        'INSERT INTO wallet.monthly_plan_lines(user_id,plan_id,category_id,amount_minor) VALUES($1,$2,$3,$4)',
        [this.db.userId, row.id, line.categoryId, line.amount],
      );
  }
  async exportRecords(): Promise<BackupMonthlyPlan[]> {
    const rows = await this.db.query(
      'SELECT month::text FROM wallet.monthly_plans WHERE user_id=$1 ORDER BY month',
      [this.db.userId],
    );
    const plans: BackupMonthlyPlan[] = [];
    for (const row of rows) {
      const plan = (await this.find(row.month.slice(0, 7)))!;
      plans.push({
        month: plan.month,
        notes: plan.notes,
        contribution: plan.contribution,
        lines: plan.lines,
      });
    }
    return plans;
  }
}
