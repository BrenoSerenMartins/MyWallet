import { CommitmentsController } from './controllers/commitments.controller.js';
import { CommitmentsService } from './services/commitments.service.js';
import { CommitmentsRepository } from './repositories/commitments.repository.js';
import { Module } from '@nestjs/common';
import { PlanningController } from './controllers/planning.controller.js';
import { PlanningRepository } from './repositories/planning.repository.js';
import { PlanningService } from './services/planning.service.js';
@Module({
  controllers: [PlanningController, CommitmentsController],
  providers: [PlanningRepository, PlanningService, CommitmentsRepository, CommitmentsService],
  exports: [PlanningService, CommitmentsService],
})
export class PlanningModule {}
export { PlanningService, CommitmentsService };
