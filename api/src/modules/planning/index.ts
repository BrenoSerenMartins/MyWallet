import { Module } from '@nestjs/common';
import { PlanningController } from './controllers/planning.controller.js';
import { PlanningRepository } from './repositories/planning.repository.js';
import { PlanningService } from './services/planning.service.js';
@Module({
  controllers: [PlanningController],
  providers: [PlanningRepository, PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
export { PlanningService };
