import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import {
  ACCOUNT_READS,
  COMMAND_RECEIPTS,
  type AccountReads,
  type GoalBackup,
  type CommandReceipts,
} from '../../../core/integration/index.js';
import { dateOnly, requireVersion, exactAmount } from '../../../core/rest/index.js';
import type { SaveGoalDto, AllocateGoalDto } from '../dto/goal.dto.js';
@Injectable()
export class GoalsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
  ) {}
  private async records() {
    const goals = await this.db.query(
      'SELECT * FROM wallet.savings_goals WHERE user_id=$1 ORDER BY priority,created_at,id',
      [this.db.userId],
    );
    const events = await this.db.query(
      'SELECT * FROM wallet.goal_allocations WHERE user_id=$1 ORDER BY created_at,id',
      [this.db.userId],
    );
    return { goals, events };
  }
  async summary() {
    const { goals, events } = await this.records();
    const accounts = (await this.accounts.list()).filter(
      (a) => !['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type),
    );
    const byAccount = accounts.map((a) => {
      const allocated = exactAmount(
        events.filter((e) => e.account_id === a.id).reduce((n, e) => n + Number(e.delta_minor), 0),
      );
      return {
        accountId: a.id,
        name: a.name,
        balance: a.balance,
        allocated,
        free: Math.max(0, a.balance - allocated),
        deficit: Math.max(0, allocated - a.balance),
      };
    });
    const today = new Date().toISOString().slice(0, 10);
    return {
      accounts: byAccount,
      allocated: byAccount.reduce((n, a) => n + a.allocated, 0),
      goals: goals.map((g) => {
        const allocations = events
          .filter((e) => e.goal_id === g.id)
          .map((e) => ({
            id: e.id,
            goalId: e.goal_id,
            accountId: e.account_id,
            delta: Number(e.delta_minor),
            reverseOfId: e.reverse_of_id,
            createdAt: new Date(e.created_at).toISOString(),
            actorId: e.actor_id,
          }));
        const allocated = exactAmount(allocations.reduce((n, e) => n + e.delta, 0)),
          target = Number(g.target_minor),
          remaining = Math.max(0, target - allocated);
        const deadline = g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null;
        const months = deadline
          ? Math.max(
              1,
              (Number(deadline.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
                Number(deadline.slice(5, 7)) -
                Number(today.slice(5, 7)) +
                1,
            )
          : null;
        return {
          id: g.id,
          name: g.name,
          target,
          deadline,
          priority: g.priority,
          status: g.status,
          version: g.version,
          allocated,
          remaining,
          progress: Math.min(100, (allocated / target) * 100),
          monthlyPace: months ? Math.ceil(remaining / months) : null,
          underfunded: byAccount.some(
            (a) =>
              a.deficit > 0 &&
              allocations
                .filter((e) => e.accountId === a.accountId)
                .reduce((n, e) => n + e.delta, 0) > 0,
          ),
          allocations,
        };
      }),
    };
  }
  private async find(id: string, lock = false) {
    const [g] = await this.db.query(
      `SELECT * FROM wallet.savings_goals WHERE user_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`,
      [this.db.userId, id],
    );
    if (!g) throw new NotFoundException('Meta não encontrada.');
    return g;
  }
  async save(input: SaveGoalDto, id?: string, version?: string) {
    if (input.deadline) dateOnly(input.deadline);
    if (!input.name.trim() || input.target <= 0)
      throw new UnprocessableEntityException('Informe um nome e valor alvo positivo.');
    exactAmount(input.target);
    if (id) {
      const g = await this.find(id, true);
      requireVersion(g.version, version);
      if (
        input.status === 'archived' &&
        (await this.summary()).goals.find((g) => g.id === id)!.allocated !== 0
      )
        throw new ConflictException('Libere o dinheiro reservado antes de arquivar a meta.');
      await this.db.query(
        'UPDATE wallet.savings_goals SET name=$3,target_minor=$4,deadline=$5,priority=$6,status=$7,version=version+1 WHERE user_id=$1 AND id=$2',
        [
          this.db.userId,
          id,
          input.name.trim(),
          input.target,
          input.deadline ?? null,
          input.priority,
          input.status ?? g.status,
        ],
      );
    } else {
      id = randomUUID();
      await this.db.query(
        'INSERT INTO wallet.savings_goals(id,user_id,name,target_minor,deadline,priority,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          id,
          this.db.userId,
          input.name.trim(),
          input.target,
          input.deadline ?? null,
          input.priority,
          this.db.actorId,
        ],
      );
    }
    return (await this.summary()).goals.find((g) => g.id === id)!;
  }
  async allocate(id: string, input: AllocateGoalDto, version: string, key: string) {
    return this.receipts.execute('goal.allocate', key, { id, input, version }, async () => {
      exactAmount(input.amount);
      if (input.amount <= 0 || !['allocate', 'release'].includes(input.action))
        throw new UnprocessableEntityException('Informe um valor positivo e uma operação válida.');
      const account = await this.accounts.find(input.accountId, true);
      const g = await this.find(id, true);
      requireVersion(g.version, version);
      if (
        account.archived ||
        ['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(account.type) ||
        g.status === 'archived'
      )
        throw new ConflictException(
          'Escolha uma conta ativa de dinheiro ou reserva e uma meta não arquivada.',
        );
      const summary = await this.summary(),
        funds = summary.accounts.find((a) => a.accountId === account.id)!;
      const held = summary.goals
        .find((x) => x.id === id)!
        .allocations.filter((e) => e.accountId === account.id)
        .reduce((n, e) => n + e.delta, 0);
      if (input.action === 'allocate' ? input.amount > funds.free : input.amount > held)
        throw new ConflictException(
          input.action === 'allocate'
            ? 'Saldo livre insuficiente para reservar.'
            : 'O valor supera a reserva desta meta na conta.',
        );
      const eventId = randomUUID();
      await this.db.query(
        'INSERT INTO wallet.goal_allocations(id,user_id,goal_id,account_id,delta_minor,actor_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          eventId,
          this.db.userId,
          id,
          account.id,
          input.amount * (input.action === 'allocate' ? 1 : -1),
          this.db.actorId,
        ],
      );
      await this.db.query(
        'UPDATE wallet.savings_goals SET version=version+1 WHERE user_id=$1 AND id=$2',
        [this.db.userId, id],
      );
      return (await this.summary()).goals.find((g) => g.id === id)!;
    });
  }
  async undo(id: string, eventId: string, version: string, key: string) {
    return this.receipts.execute('goal.undo', key, { id, eventId, version }, async () => {
      const [event] = await this.db.query(
        'SELECT * FROM wallet.goal_allocations WHERE user_id=$1 AND id=$2 AND goal_id=$3',
        [this.db.userId, eventId, id],
      );
      if (!event || event.reverse_of_id)
        throw new ConflictException('Escolha uma alocação original.');
      const account = await this.accounts.find(event.account_id, true),
        g = await this.find(id, true);
      requireVersion(g.version, version);
      if (
        (
          await this.db.query(
            'SELECT id FROM wallet.goal_allocations WHERE user_id=$1 AND reverse_of_id=$2',
            [this.db.userId, eventId],
          )
        ).length
      )
        throw new ConflictException('Esta alocação já foi desfeita.');
      const summary = await this.summary(),
        held = summary.goals
          .find((g) => g.id === id)!
          .allocations.filter((e) => e.accountId === account.id)
          .reduce((n, e) => n + e.delta, 0),
        delta = -Number(event.delta_minor);
      if (
        (delta < 0 && held + delta < 0) ||
        (delta > 0 && delta > summary.accounts.find((a) => a.accountId === account.id)!.free)
      )
        throw new ConflictException(
          'As alocações posteriores ou o saldo da conta impedem desfazer esta operação.',
        );
      await this.db.query(
        'INSERT INTO wallet.goal_allocations(id,user_id,goal_id,account_id,delta_minor,reverse_of_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), this.db.userId, id, account.id, delta, eventId, this.db.actorId],
      );
      await this.db.query(
        'UPDATE wallet.savings_goals SET version=version+1 WHERE user_id=$1 AND id=$2',
        [this.db.userId, id],
      );
      return (await this.summary()).goals.find((g) => g.id === id)!;
    });
  }
  async exportManaged() {
    return this.summary();
  }
  async restoreManaged(data: GoalBackup, accounts: Map<string, string>) {
    for (const g of data.goals) {
      const id = randomUUID();
      await this.db.query(
        'INSERT INTO wallet.savings_goals(id,user_id,name,target_minor,deadline,priority,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, this.db.userId, g.name, g.target, g.deadline, g.priority, g.status, this.db.actorId],
      );
      const ids = new Map(g.allocations.map((e) => [e.id, randomUUID()]));
      for (const e of [
        ...g.allocations.filter((e) => !e.reverseOfId),
        ...g.allocations.filter((e) => e.reverseOfId),
      ])
        await this.db.query(
          'INSERT INTO wallet.goal_allocations(id,user_id,goal_id,account_id,delta_minor,reverse_of_id,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            ids.get(e.id),
            this.db.userId,
            id,
            accounts.get(e.accountId),
            e.delta,
            e.reverseOfId ? ids.get(e.reverseOfId) : null,
            this.db.actorId,
            e.createdAt,
          ],
        );
    }
  }
}
