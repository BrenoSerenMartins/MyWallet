import { ImportReconciliationService } from './services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from './repositories/import-reconciliation.repository.js';
import { SettlementEvidenceRepository } from './repositories/settlement-evidence.repository.js';
import { SettlementMatchingService } from './services/settlement-matching.service.js';
import { ImportReprocessingService } from './services/import-reprocessing.service.js';
import { Module } from '@nestjs/common';
import { ImportsController } from './controllers/imports.controller.js';
import { ImportsRepository } from './repositories/imports.repository.js';
import { ImportsService } from './services/imports.service.js';
@Module({
  controllers: [ImportsController],
  providers: [
    ImportReconciliationService,
    ImportReconciliationRepository,
    ImportsRepository,
    ImportsService,
    ImportReprocessingService,
    SettlementEvidenceRepository,
    SettlementMatchingService,
  ],
})
export class ImportsModule {}
