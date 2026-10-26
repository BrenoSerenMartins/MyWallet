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
    dateOnly(input.openingDate);
    const id = await this.repository.create(input);
    return this.find(id);
  }
  async initializeFromStatement(id: string, balance: number, date: string) {
    const account = await this.find(id, true);
    if (account.archived || (await this.repository.hasTransactions(id)))
      throw new ConflictException('A posição inicial de uma conta com movimentos será preservada.');
    dateOnly(date);
    await this.repository.update(id, { ...account, openingBalance: balance, openingDate: date });
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
    this.validateProduct(input);
    dateOnly(input.openingDate);
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
