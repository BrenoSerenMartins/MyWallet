import { Module } from '@nestjs/common';
import { WealthController } from './controllers/wealth.controller.js';
import { WealthRepository } from './repositories/wealth.repository.js';
import { WealthService } from './services/wealth.service.js';
@Module({
  controllers: [WealthController],
  providers: [WealthRepository, WealthService],
  exports: [WealthService],
})
export class WealthModule {}
export { WealthService };
