import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import {
  CARD_FORECAST,
  GOALS_READS,
  PLANNING_READS,
  COMMITMENT_READS,
  type CardForecast,
  type GoalsReads,
  type PlanningReads,
  type CommitmentReads,
} from '../../../core/integration/index.js';
import type { AlertPreferencesDto } from '../dto/alerts.dto.js';
const defaults: AlertPreferencesDto = {
  dueDays: 3,
  budgetPercent: 100,
  bills: true,
  budgets: true,
  negativeBalance: true,
  goals: true,
};
@Injectable()
export class AlertsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CARD_FORECAST) private readonly cards: CardForecast,
    @Inject(GOALS_READS) private readonly goals: GoalsReads,
    @Inject(PLANNING_READS) private readonly planning: PlanningReads,
    @Inject(COMMITMENT_READS) private readonly commitments: CommitmentReads,
  ) {}
  async preferences() {
    const [p] = await this.db.query(
      'SELECT due_days AS "dueDays",budget_percent AS "budgetPercent",bills,budgets,negative_balance AS "negativeBalance",goals FROM wallet.alert_preferences WHERE user_id=$1 AND workspace_id=wallet.current_workspace_id()',
      [this.db.actorId],
    );
    return (p as AlertPreferencesDto | undefined) ?? defaults;
  }
  async save(p: AlertPreferencesDto) {
    await this.db.query(
      'INSERT INTO wallet.alert_preferences(user_id,due_days,budget_percent,bills,budgets,negative_balance,goals) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,workspace_id) DO UPDATE SET due_days=EXCLUDED.due_days,budget_percent=EXCLUDED.budget_percent,bills=EXCLUDED.bills,budgets=EXCLUDED.budgets,negative_balance=EXCLUDED.negative_balance,goals=EXCLUDED.goals',
      [this.db.actorId, p.dueDays, p.budgetPercent, p.bills, p.budgets, p.negativeBalance, p.goals],
    );
    return this.sync();
  }
  async list() {
    return {
      preferences: await this.preferences(),
      items: await this.db.query(
        'SELECT id,kind,title,href,created_at AS "createdAt",read_at AS "readAt" FROM wallet.financial_alerts WHERE user_id=$1 AND workspace_id=wallet.current_workspace_id() AND dismissed_at IS NULL AND resolved_at IS NULL ORDER BY created_at DESC,id LIMIT 100',
        [this.db.actorId],
      ),
    };
  }
  async sync() {
    const p = await this.preferences(),
      today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
      month = today.slice(0, 7),
      end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + p.dueDays);
    const due = end.toISOString().slice(0, 10),
      active: { key: string; kind: string; title: string; href: string }[] = [];
    if (p.bills)
      for (const b of await this.cards.pendingBills(due))
        active.push({
          key: `bill:${b.cardId}:${b.billMonth}`,
          kind: 'bill',
          title: `${b.description} ${b.dueDate < today ? 'está vencida' : `vence em ${b.dueDate.split('-').reverse().join('/')}`}.`,
          href: `/cards?card=${b.cardId}&month=${b.billMonth}`,
        });
    if (p.budgets)
      for (const l of (await this.planning.summary(month)).lines)
        if (
          l.type === 'expense' &&
          l.planned !== null &&
          l.actual > 0 &&
          (l.planned === 0 || l.actual * 100 >= l.planned * p.budgetPercent)
        )
          active.push({
            key: `budget:${month}:${l.categoryId ?? 'other'}`,
            kind: 'budget',
            title: `${l.name}: ${l.actual > l.planned ? 'orçamento excedido' : `atingiu ${p.budgetPercent}% do orçamento`}.`,
            href: `/planning?month=${month}`,
          });
    if (p.negativeBalance)
      for (const a of (await this.commitments.summary(month)).projection)
        if (a.projected < 0)
          active.push({
            key: `negative:${month}:${a.accountId}`,
            kind: 'negative',
            title: `${a.name}: previsão de saldo negativo neste mês.`,
            href: `/accounts/${a.accountId}`,
          });
    if (p.goals)
      for (const g of (await this.goals.summary()).goals)
        if (
          g.status === 'active' &&
          (g.underfunded || (g.deadline && g.deadline < today && g.remaining > 0))
        )
          active.push({
            key: `goal:${g.id}`,
            kind: 'goal',
            title: `${g.name}: ${g.underfunded ? 'saldo insuficiente para cobrir as reservas' : 'prazo encerrado com valor ainda a reservar'}.`,
            href: '/goals',
          });
    // The condition key persists across visits: dismissed/read alerts do not reopen while unchanged.
    for (const a of active)
      await this.db.query(
        'INSERT INTO wallet.financial_alerts(id,user_id,origin_key,kind,title,href) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,workspace_id,origin_key) DO UPDATE SET title=EXCLUDED.title,href=EXCLUDED.href,updated_at=clock_timestamp(),read_at=CASE WHEN wallet.financial_alerts.resolved_at IS NOT NULL THEN NULL ELSE wallet.financial_alerts.read_at END,dismissed_at=CASE WHEN wallet.financial_alerts.resolved_at IS NOT NULL THEN NULL ELSE wallet.financial_alerts.dismissed_at END,resolved_at=NULL',
        [randomUUID(), this.db.actorId, a.key, a.kind, a.title, a.href],
      );
    await this.db.query(
      'UPDATE wallet.financial_alerts SET resolved_at=clock_timestamp() WHERE user_id=$1 AND workspace_id=wallet.current_workspace_id() AND resolved_at IS NULL AND NOT(origin_key=ANY($2::text[]))',
      [this.db.actorId, active.map((a) => a.key)],
    );
    return this.list();
  }
  async action(id: string, action: 'read' | 'dismiss') {
    await this.db.query(
      `UPDATE wallet.financial_alerts SET ${action === 'read' ? 'read_at' : 'dismissed_at'}=coalesce(${action === 'read' ? 'read_at' : 'dismissed_at'},clock_timestamp()) WHERE user_id=$1 AND workspace_id=wallet.current_workspace_id() AND id=$2`,
      [this.db.actorId, id],
    );
    return { status: 'updated' };
  }
}
