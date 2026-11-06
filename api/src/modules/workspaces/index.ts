import { SharingService } from './services/sharing.service.js';
import { SharingController } from './controllers/sharing.controller.js';
import { Module } from '@nestjs/common';
import { WorkspacesController } from './controllers/workspaces.controller.js';
import { WorkspacesService } from './services/workspaces.service.js';
import { WorkspacesRepository } from './repositories/workspaces.repository.js';
@Module({
  controllers: [WorkspacesController, SharingController],
  providers: [WorkspacesService, WorkspacesRepository, SharingService],
})
export class WorkspacesModule {}
