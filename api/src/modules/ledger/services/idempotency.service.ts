import { ConflictException, Inject, Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async execute<T>(
    operation: string,
    key: string,
    input: unknown,
    action: () => Promise<T>,
  ): Promise<T> {
    if (!key || key.length > 120)
      throw new BadRequestException('Uma chave de confirmação é obrigatória.');
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    await this.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      this.db.userId + operation + key,
    ]);
    const [receipt] = await this.db.query(
      'SELECT request_hash,result FROM wallet.command_receipts WHERE user_id=$1 AND operation=$2 AND idempotency_key=$3',
      [this.db.userId, operation, key],
    );
    if (receipt) {
      if (receipt.request_hash !== hash)
        throw new ConflictException('Esta chave já foi usada para outra operação.');
      return receipt.result;
    }
    const result = await action();
    await this.db.query(
      'INSERT INTO wallet.command_receipts(id,user_id,operation,idempotency_key,request_hash,result) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), this.db.userId, operation, key, hash, JSON.stringify(result)],
    );
    return result;
  }
}
