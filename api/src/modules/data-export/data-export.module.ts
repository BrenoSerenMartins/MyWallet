import { Module } from '@nestjs/common';
import { DataExportController } from './controllers/data-export.controller.js';
import { DataExportService } from './services/data-export.service.js';
import { RestoreRepository } from './repositories/restore.repository.js';
@Module({ controllers: [DataExportController], providers: [DataExportService, RestoreRepository] })
export class DataExportModule {}
