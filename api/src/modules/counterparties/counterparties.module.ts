import { CounterpartyRulesWorkflow } from './services/counterparty-rules-workflow.js';
import { Module } from '@nestjs/common';
import { CounterpartiesController } from './controllers/counterparties.controller.js';
import { CounterpartiesRepository } from './repositories/counterparties.repository.js';
import { CounterpartiesService } from './services/counterparties.service.js';
@Module({
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService, CounterpartiesRepository, CounterpartyRulesWorkflow],
  exports: [CounterpartiesService],
})
export class CounterpartiesModule {}
