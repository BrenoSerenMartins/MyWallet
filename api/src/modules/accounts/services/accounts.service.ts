import {
  ConflictException,
  UnprocessableEntityException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccountReads } from '../../../core/integration/index.js';
import { dateOnly, requireVersion } from '../../../core/rest/index.js';
import { AccountsRepository } from '../repositories/accounts.repository.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
@Injectable()
export class AccountsService implements AccountReads {
  constructor(@Inject(AccountsRepository) private readonly repository: AccountsRepository) {}
  async exportRecords() {
    return this.repository.list();
  }
  async restoreRecord(record: import('../../../core/integration/index.js').BackupAccount) {
    return (await this.create({ ...record })).id;
  }
  list() {
    return this.repository.list();
  }
  async find(id: string, lock = false) {
    if (lock) await this.repository.lock(id);
    const account = (await this.list()).find((a) => a.id === id);
    if (!account) throw new NotFoundException('Conta não encontrada.');
    return account;
  }
  private validateProduct(input: CreateAccountDto) {
    const benefit = ['benefit_food', 'benefit_meal'].includes(input.type);
    if ((input.institution === 'alelo') !== benefit)
      throw new UnprocessableEntityException(
        'Use Alelo com o tipo Alimentação ou Refeição, em contas separadas.',
      );
  }
  async create(input: CreateAccountDto) {
    this.validateProduct(input);
    const normalized = {
      ...input,
      openingBalance: input.openingBalance ?? 0,
      openingDate: input.openingDate ?? new Date().toISOString().slice(0, 10),
    };
    dateOnly(normalized.openingDate);
    const id = await this.repository.create(normalized);
    return this.find(id);
  }
  async update(id: string, input: CreateAccountDto, version: string) {
    const account = await this.find(id, true);
    requireVersion(account.version, version);
    if (
      (account.institution !== input.institution || account.type !== input.type) &&
      (await this.repository.hasTransactions(id))
    )
      throw new ConflictException(
        'A instituição e o tipo de uma conta com movimentos devem ser preservados. Crie outra conta e revise os registros.',
      );
    input = {
      ...input,
      openingBalance: input.openingBalance ?? account.openingBalance,
      openingDate: input.openingDate ?? account.openingDate,
    };
    this.validateProduct(input);
    dateOnly(input.openingDate!);
    if (
      (account.openingBalance !== input.openingBalance ||
        account.openingDate !== input.openingDate) &&
      (await this.repository.hasTransactions(id))
    )
      throw new ConflictException(
        'A posição inicial de uma conta com movimentos exige reconciliação.',
      );
    await this.repository.update(id, input);
    return this.find(id);
  }
}
