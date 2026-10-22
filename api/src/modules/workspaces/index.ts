import { Module } from '@nestjs/common';
import { WorkspacesController } from './controllers/workspaces.controller.js';
import { WorkspacesService } from './services/workspaces.service.js';
import { WorkspacesRepository } from './repositories/workspaces.repository.js';
@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
})
export class WorkspacesModule {}
