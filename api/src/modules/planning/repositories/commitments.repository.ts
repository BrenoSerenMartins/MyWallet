import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type { CommitmentSchedule, CommitmentRecord } from '../../../core/integration/index.js';
import type { SaveCommitmentDto } from '../dto/commitments.dto.js';
@Injectable()
export class CommitmentsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async lock() {
    await this.db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':commitments:' || wallet.current_workspace_id()::text,0))",
      [this.db.userId],
    );
  }
  async schedules(): Promise<CommitmentSchedule[]> {
    const rows = await this.db.query(
      'SELECT * FROM wallet.commitment_schedules WHERE user_id=$1 ORDER BY start_date,id',
      [this.db.userId],
    );
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      categoryId: r.category_id,
      description: r.description,
      amount: Number(r.amount_minor),
      transactionType: r.transaction_type,
      frequency: r.frequency,
      startDate: isoDate(r.start_date),
      endDate: r.end_date ? isoDate(r.end_date) : null,
      endedOn: r.ended_on ? isoDate(r.ended_on) : null,
      version: r.version,
    }));
  }
  async records(): Promise<CommitmentRecord[]> {
    const rows = await this.db.query(
      'SELECT * FROM wallet.commitment_occurrences WHERE user_id=$1 ORDER BY due_date,schedule_id',
      [this.db.userId],
    );
    return rows.map((r) => ({
      scheduleId: r.schedule_id,
      dueDate: isoDate(r.due_date),
      status: r.status,
      transactionId: r.transaction_id,
      snapshot: r.snapshot,
    }));
  }
  async create(input: SaveCommitmentDto) {
    const [row] = await this.db.query(
      `INSERT INTO wallet.commitment_schedules(user_id,account_id,category_id,description,amount_minor,transaction_type,frequency,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        this.db.userId,
        input.accountId,
        input.categoryId ?? null,
        input.description.trim(),
        input.amount,
        input.transactionType,
        input.frequency,
        input.startDate,
        input.endDate ?? null,
      ],
    );
    return row.id as string;
  }
  async update(id: string, input: SaveCommitmentDto) {
    await this.db.query(
      'UPDATE wallet.commitment_schedules SET category_id=$3,description=$4,amount_minor=$5,end_date=$6,version=version+1 WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        id,
        input.categoryId ?? null,
        input.description.trim(),
        input.amount,
        input.endDate ?? null,
      ],
    );
  }
  async end(id: string, today: string) {
    await this.db.query(
      'UPDATE wallet.commitment_schedules SET ended_on=$3,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id, today],
    );
  }
  async record(row: CommitmentRecord) {
    await this.db.query(
      `INSERT INTO wallet.commitment_occurrences(user_id,schedule_id,due_date,status,transaction_id,snapshot) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,workspace_id,schedule_id,due_date) DO UPDATE SET status=EXCLUDED.status,transaction_id=EXCLUDED.transaction_id,snapshot=EXCLUDED.snapshot`,
      [
        this.db.userId,
        row.scheduleId,
        row.dueDate,
        row.status,
        row.transactionId,
        JSON.stringify(row.snapshot),
      ],
    );
    await this.bump(row.scheduleId);
  }
  async reopen(id: string, date: string) {
    await this.db.query(
      'DELETE FROM wallet.commitment_occurrences WHERE user_id=$1 AND schedule_id=$2 AND due_date=$3',
      [this.db.userId, id, date],
    );
    await this.bump(id);
  }
  private async bump(id: string) {
    await this.db.query(
      'UPDATE wallet.commitment_schedules SET version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
}
