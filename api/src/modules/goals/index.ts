import { Module } from '@nestjs/common';
import { GoalsService } from './services/goals.service.js';
import { GoalsController } from './controllers/goals.controller.js';
@Module({ providers: [GoalsService], controllers: [GoalsController], exports: [GoalsService] })
export class GoalsModule {}
export { GoalsService };
