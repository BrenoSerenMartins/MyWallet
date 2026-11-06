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
import { SUPPORTED_ACCOUNT_INSTITUTIONS } from '../dto/create-account.dto.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';
@Injectable()
export class AccountsService implements AccountReads {
  constructor(@Inject(AccountsRepository) private readonly repository: AccountsRepository) {}
  async exportRecords() {
    return this.repository.list();
  }
  async restoreRecord(record: import('../../../core/integration/index.js').BackupAccount) {
    return (
      await this.create({
        ...record,
        defaultIncomeCategoryId: null,
        defaultExpenseCategoryId: null,
      })
    ).id;
  }
  async restoreDefaults(id: string, income: string | null, expense: string | null) {
    await this.repository.setDefaults(id, income, expense);
  }
  private async validateDefaults(input: UpdateAccountDto) {
    for (const [id, type] of [
      [input.defaultIncomeCategoryId, 'income'],
      [input.defaultExpenseCategoryId, 'expense'],
    ] as const) {
      if (id && !(await this.repository.defaultCategory(id, type)))
        throw new UnprocessableEntityException(
          'Escolha uma categoria ativa do tipo correspondente nesta conta.',
        );
    }
  }
  createManaged(name: string, type: 'credit_card' | 'investment', openingBalance = 0) {
    return this.create({ name, institution: type, type, openingBalance });
  }
  positions(dates: string[]) {
    return this.repository.positions(dates);
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
  private validateProduct(input: UpdateAccountDto) {
    const benefit = ['benefit_food', 'benefit_meal'].includes(input.type);
    if (!benefit && input.benefitCreditMonth === 'following')
      throw new UnprocessableEntityException(
        'A competência do benefício é exclusiva das contas de Alimentação ou Refeição.',
      );
    if ((input.institution === 'alelo') !== benefit)
      throw new UnprocessableEntityException(
        'Use Alelo com o tipo Alimentação ou Refeição, em contas separadas.',
      );
  }
  async create(input: UpdateAccountDto) {
    this.validateProduct(input);
    await this.validateDefaults(input);
    const normalized = {
      ...input,
      openingBalance: input.openingBalance ?? 0,
      openingDate: input.openingDate ?? new Date().toISOString().slice(0, 10),
    };
    dateOnly(normalized.openingDate);
    const id = await this.repository.create(normalized);
    await this.repository.setDefaults(
      id,
      input.defaultIncomeCategoryId ?? null,
      input.defaultExpenseCategoryId ?? null,
    );
    return this.find(id);
  }
  async setBenefitMonth(id: string, month: 'received' | 'following', version: string) {
    const account = await this.find(id, true);
    requireVersion(account.version, version);
    if (
      !['benefit_food', 'benefit_meal'].includes(account.type) ||
      !['received', 'following'].includes(month)
    )
      throw new UnprocessableEntityException('Esta regra é exclusiva dos créditos de VA/VR.');
    await this.repository.setBenefitMonth(id, month);
    return this.find(id);
  }
  async update(id: string, input: UpdateAccountDto, version: string) {
    const account = await this.find(id, true);
    if (['credit_card', 'investment'].includes(account.type))
      throw new ConflictException(
        'Use o módulo de cartões ou investimentos para alterar esta posição.',
      );
    requireVersion(account.version, version);
    if (
      account.institution !== input.institution &&
      !SUPPORTED_ACCOUNT_INSTITUTIONS.some((institution) => institution === input.institution)
    )
      throw new UnprocessableEntityException(
        'Escolha uma instituição disponível: Mercado Pago ou Alelo.',
      );
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
      benefitCreditMonth: input.benefitCreditMonth ?? account.benefitCreditMonth ?? 'received',
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
    await this.validateDefaults({
      ...input,
      defaultIncomeCategoryId:
        input.defaultIncomeCategoryId === account.defaultIncomeCategoryId
          ? undefined
          : input.defaultIncomeCategoryId,
      defaultExpenseCategoryId:
        input.defaultExpenseCategoryId === account.defaultExpenseCategoryId
          ? undefined
          : input.defaultExpenseCategoryId,
    });
    await this.repository.update(id, input);
    await this.repository.setDefaults(
      id,
      input.defaultIncomeCategoryId === undefined
        ? (account.defaultIncomeCategoryId ?? null)
        : input.defaultIncomeCategoryId,
      input.defaultExpenseCategoryId === undefined
        ? (account.defaultExpenseCategoryId ?? null)
        : input.defaultExpenseCategoryId,
    );
    return this.find(id);
  }
}
