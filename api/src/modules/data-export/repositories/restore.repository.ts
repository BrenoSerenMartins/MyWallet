import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { BackupPayload } from '../../../core/integration/index.js';
@Injectable()
export class RestoreRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async create(payload: BackupPayload) {
    const id = randomUUID();
    await this.db.query('INSERT INTO wallet.restore_batches(id,user_id,payload) VALUES($1,$2,$3)', [
      id,
      this.db.userId,
      JSON.stringify(payload),
    ]);
    return id;
  }
  async find(id: string) {
    return (
      await this.db.query(
        'SELECT * FROM wallet.restore_batches WHERE user_id=$1 AND id=$2 FOR UPDATE',
        [this.db.userId, id],
      )
    )[0];
  }
  async confirm(id: string) {
    await this.db.query(
      "UPDATE wallet.restore_batches SET status='confirmed',confirmed_at=now(),payload='{}'::jsonb WHERE user_id=$1 AND id=$2",
      [this.db.userId, id],
    );
  }
}
