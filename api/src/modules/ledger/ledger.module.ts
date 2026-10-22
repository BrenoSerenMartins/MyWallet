import { Module } from '@nestjs/common';
import { LedgerController } from './controllers/ledger.controller.js';
import { LedgerRepository } from './repositories/ledger.repository.js';
import { LedgerService } from './services/ledger.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
@Module({
  controllers: [LedgerController],
  providers: [LedgerRepository, LedgerService, IdempotencyService],
  exports: [LedgerService, IdempotencyService],
})
export class LedgerModule {}
