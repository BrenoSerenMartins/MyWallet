import { BalanceBasisRepository } from './repositories/balance-basis.repository.js';
import { BalanceBasisService } from './services/balance-basis.service.js';
import { BalanceBasisController } from './controllers/balance-basis.controller.js';
import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller.js';
import { AccountsService } from './services/accounts.service.js';
import { AccountsRepository } from './repositories/accounts.repository.js';
@Module({
  controllers: [AccountsController, BalanceBasisController],
  providers: [AccountsService, AccountsRepository, BalanceBasisRepository, BalanceBasisService],
  exports: [AccountsService, BalanceBasisService],
})
export class AccountsModule {}
