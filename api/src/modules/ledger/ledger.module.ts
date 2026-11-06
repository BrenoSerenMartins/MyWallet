import { RecognitionController } from './controllers/recognition.controller.js';
import { RecognitionService } from './services/recognition.service.js';
import { Module } from '@nestjs/common';
import { LedgerController } from './controllers/ledger.controller.js';
import { LedgerRepository } from './repositories/ledger.repository.js';
import { LedgerService } from './services/ledger.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
@Module({
  controllers: [LedgerController, RecognitionController],
  providers: [LedgerRepository, LedgerService, IdempotencyService, RecognitionService],
  exports: [LedgerService, IdempotencyService],
})
export class LedgerModule {}
