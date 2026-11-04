import { Module } from '@nestjs/common';
import { CardsController } from './controllers/cards.controller.js';
import { CardsRepository } from './repositories/cards.repository.js';
import { CardsService } from './services/cards.service.js';
@Module({
  controllers: [CardsController],
  providers: [CardsRepository, CardsService],
  exports: [CardsService],
})
export class CardsModule {}
export { CardsService };
