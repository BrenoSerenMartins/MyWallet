import { ImportReprocessingService } from './services/import-reprocessing.service.js';
import { Module } from '@nestjs/common';
import { ImportsController } from './controllers/imports.controller.js';
import { ImportsRepository } from './repositories/imports.repository.js';
import { ImportsService } from './services/imports.service.js';
@Module({
  controllers: [ImportsController],
  providers: [ImportsRepository, ImportsService, ImportReprocessingService],
})
export class ImportsModule {}
