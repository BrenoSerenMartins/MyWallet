import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller.js';
import { AccountsService } from './services/accounts.service.js';
import { AccountsRepository } from './repositories/accounts.repository.js';
@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
