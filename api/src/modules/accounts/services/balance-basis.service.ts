import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AccountBalanceBasis,
  BalanceBasis,
  BalanceHistory,
  BalanceCorrectionInput,
  BackupAccount,
  BackupTransaction,
} from '../../../core/integration/index.js';
import { exactAmount, requireVersion } from '../../../core/rest/index.js';
import { BalanceBasisRepository } from '../repositories/balance-basis.repository.js';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
@Injectable()
export class BalanceBasisService implements AccountBalanceBasis {
  constructor(@Inject(BalanceBasisRepository) private readonly repo: BalanceBasisRepository) {}
  private async state(id: string) {
    const state = await this.repo.state(id);
    if (!state) throw new NotFoundException('Conta não encontrada.');
    return state;
  }
  private event(
    accountId: string,
    operation: BalanceHistory['operation'],
    previousBase: number,
    newBase: number,
    previousBasis: BalanceBasis,
    newBasis: BalanceBasis,
    reason: string,
    id = randomUUID(),
  ): BalanceHistory {
    return {
      id,
      accountId,
      operation,
      previousBase,
      newBase,
      previousBasis,
      newBasis,
      reason,
      details: {},
      undoOfId: null,
      createdAt: new Date().toISOString(),
    };
  }
  async correct(accountId: string, input: BalanceCorrectionInput) {
    const s = await this.state(accountId);
    if (s.archived) throw new ConflictException('Esta conta está arquivada.');
    if (input.expectedVersion !== undefined) requireVersion(s.version, input.expectedVersion);
    if (s.balance !== input.expectedBalance)
      throw new ConflictException(
        'O saldo mudou. Atualize a conta e confira a diferença novamente.',
      );
    exactAmount(input.targetBalance);
    const difference = exactAmount(input.targetBalance - s.balance);
    if (!difference && s.basis.kind !== 'unknown' && !s.basis.reviewRequired)
      throw new UnprocessableEntityException('O saldo já corresponde ao valor informado.');
    if (!input.reason.trim())
      throw new UnprocessableEntityException('Informe o motivo da correção.');
    const date = today();
    if (!(await this.repo.snapshot(accountId, date)))
      throw new ConflictException(
        'Existem lançamentos futuros nesta conta. Revise-os antes de corrigir o saldo atual.',
      );
    const id = randomUUID();
    const base = exactAmount(s.base + difference);
    const basis: BalanceBasis = {
      kind: 'manual',
      referenceDate: date,
      referenceBalance: input.targetBalance,
      originId: id,
      reviewRequired: false,
    };
    const event = this.event(
      accountId,
      'manual',
      s.base,
      base,
      s.basis,
      basis,
      input.reason.trim(),
      id,
    );
    event.details = {
      previousBalance: s.balance,
      targetBalance: input.targetBalance,
      difference,
      knownSameDayIds: await this.repo.knownDateIds(accountId, date),
    };
    await this.repo.write(accountId, base, basis);
    return this.repo.append(event);
  }
  async refresh(accountId: string, importedDate?: string) {
    const s = await this.state(accountId);
    const b = s.basis;
    if (
      !b.referenceDate ||
      b.referenceBalance === undefined ||
      !['manual', 'statement'].includes(b.kind)
    )
      return;
    const base = exactAmount(
      b.referenceBalance - (await this.repo.net(accountId, b.referenceDate, b.kind === 'manual')),
    );
    const basis: BalanceBasis = {
      ...b,
      reviewReason:
        b.reviewReason ??
        (b.kind === 'manual' && importedDate === b.referenceDate ? 'same_day' : undefined),
      reviewRequired:
        !!b.reviewRequired || (b.kind === 'manual' && importedDate === b.referenceDate),
    };
    if (base === s.base && !!basis.reviewRequired === !!b.reviewRequired) return;
    await this.repo.write(accountId, base, basis);
    await this.repo.append(
      this.event(
        accountId,
        'rebase',
        s.base,
        base,
        b,
        basis,
        'Recálculo da base após alteração do histórico',
      ),
    );
  }
  async considerStatement(accountId: string, importId: string) {
    const s = await this.state(accountId);
    if (s.archived) throw new ConflictException('Esta conta está arquivada.');
    const source = await this.repo.statement(accountId, importId);
    if (
      !source ||
      source.type !== 'account_statement' ||
      source.opening === null ||
      source.status !== 'confirmed'
    )
      return { status: 'unavailable' };
    if (!source.complete) return { status: 'partial' };
    const b = s.basis;
    if (b.kind === 'statement' && b.referenceDate! <= source.date) return { status: 'unchanged' };
    const base = exactAmount(source.opening - (await this.repo.net(accountId, source.date, false)));
    if (b.kind !== 'unknown' && base !== s.base) {
      const difference = exactAmount(base - s.base);
      if (!b.reviewRequired || b.reviewReason !== 'statement_conflict') {
        const flagged: BalanceBasis = {
          ...b,
          reviewRequired: true,
          reviewReason: 'statement_conflict',
        };
        await this.repo.write(accountId, s.base, flagged);
        const event = this.event(
          accountId,
          'rebase',
          s.base,
          s.base,
          b,
          flagged,
          'Saldo do extrato diverge da referência existente; base preservada',
        );
        event.details = { importId, difference };
        await this.repo.append(event);
      }
      return { status: 'conflict', difference };
    }
    const id = randomUUID();
    const basis: BalanceBasis = {
      kind: 'statement',
      referenceDate: source.date,
      referenceBalance: source.opening,
      importId,
      originId: id,
      reviewRequired: false,
    };
    await this.repo.write(accountId, base, basis);
    await this.repo.append(
      this.event(
        accountId,
        'statement',
        s.base,
        base,
        b,
        basis,
        'Saldo base identificado no extrato confirmado',
        id,
      ),
    );
    return { status: 'applied' };
  }
  async history(accountId: string) {
    const state = await this.state(accountId);
    const history = await this.repo.history(accountId);
    if (state.basis.originId && !history.some((event) => event.id === state.basis.originId)) {
      const active = await this.repo.event(accountId, state.basis.originId);
      if (active) history.push(active);
    }
    return history;
  }
  async undo(accountId: string, id: string, version: number) {
    const s = await this.state(accountId);
    const history = await this.repo.history(accountId, true);
    const previousUndo = history.find((event) => event.undoOfId === id);
    if (previousUndo) return previousUndo;
    requireVersion(s.version, version);
    const original = history.find((event) => event.id === id);
    if (s.archived || !original || original.operation !== 'manual' || s.basis.originId !== id)
      throw new ConflictException('Só a correção manual ainda ativa pode ser desfeita.');
    const basis = original.previousBasis;
    if (basis.kind === 'manual') {
      const earlier = history.find((event) => event.id === basis.originId);
      if (!earlier || !Array.isArray(earlier.details.knownSameDayIds))
        throw new ConflictException(
          'Confira o saldo atual para substituir esta referência antiga.',
        );
      await this.repo.restoreMarkers(accountId, earlier.details.knownSameDayIds as string[]);
    }
    const base =
      basis.referenceDate &&
      basis.referenceBalance !== undefined &&
      ['manual', 'statement'].includes(basis.kind)
        ? exactAmount(
            basis.referenceBalance -
              (await this.repo.net(accountId, basis.referenceDate, basis.kind === 'manual')),
          )
        : original.previousBase;
    const event = this.event(
      accountId,
      'undo',
      s.base,
      base,
      s.basis,
      basis,
      'Desfazimento de correção manual',
    );
    event.undoOfId = id;
    await this.repo.write(accountId, base, basis);
    return this.repo.append(event);
  }
  async removeStatement(accountId: string, importId: string) {
    const s = await this.state(accountId);
    if (s.basis.kind !== 'statement' || s.basis.importId !== importId) return;
    const history = await this.repo.history(accountId, true);
    const event = history.find((row) => row.id === s.basis.originId);
    if (!event) throw new ConflictException('Não foi possível localizar a origem do saldo base.');
    const basis = event.previousBasis;
    if (basis.kind === 'manual') {
      const observation = history.find((row) => row.id === basis.originId);
      if (!observation || !Array.isArray(observation.details.knownSameDayIds))
        throw new ConflictException(
          'Confira o saldo atual antes de desfazer esta referência antiga.',
        );
      await this.repo.restoreMarkers(accountId, observation.details.knownSameDayIds as string[]);
    }
    const base =
      basis.referenceDate &&
      basis.referenceBalance !== undefined &&
      ['manual', 'statement'].includes(basis.kind)
        ? exactAmount(
            basis.referenceBalance -
              (await this.repo.net(accountId, basis.referenceDate, basis.kind === 'manual')),
          )
        : event.previousBase;
    await this.repo.write(accountId, base, basis);
    await this.repo.append(
      this.event(
        accountId,
        'undo',
        s.base,
        base,
        s.basis,
        basis,
        'Base restaurada após desfazer o extrato',
      ),
    );
  }
  exportHistory() {
    return this.repo.history();
  }
  async restoreBackup(
    accounts: BackupAccount[],
    transactions: BackupTransaction[],
    history: BalanceHistory[],
    mapping: Map<string, string>,
    transactionIds: Map<string, string>,
  ) {
    const ids = new Map(history.map((event) => [event.id, randomUUID()]));
    const remap = (basis: BalanceBasis): BalanceBasis => ({
      ...basis,
      originId: basis.originId ? ids.get(basis.originId) : undefined,
      importId: undefined,
    });
    for (const event of [...history].reverse())
      await this.repo.append({
        ...event,
        id: ids.get(event.id)!,
        accountId: mapping.get(event.accountId)!,
        previousBasis: remap(event.previousBasis),
        newBasis: remap(event.newBasis),
        undoOfId: event.undoOfId ? ids.get(event.undoOfId)! : null,
        details: {
          ...event.details,
          ...(Array.isArray(event.details.knownSameDayIds)
            ? {
                knownSameDayIds: event.details.knownSameDayIds.flatMap((id) =>
                  transactionIds.has(String(id)) ? [transactionIds.get(String(id))!] : [],
                ),
              }
            : {}),
        },
      });
    for (const account of accounts) {
      const accountId = mapping.get(account.id)!;
      const legacy = transactions.filter((t) => t.accountId === account.id && t.balanceAdjustment);
      const base = exactAmount(
        account.openingBalance + legacy.reduce((sum, t) => sum + t.amount, 0),
      );
      let basis = remap(account.balanceBasis ?? { kind: base ? 'legacy' : 'unknown' });
      if (legacy.length) {
        const id = randomUUID();
        const date = today();
        await this.repo.setMarkers(accountId, true);
        const target = exactAmount(base + (await this.repo.net(accountId, date, true)));
        basis = {
          kind: 'manual',
          referenceDate: date,
          referenceBalance: target,
          originId: id,
          reviewRequired: false,
        };
        const event = this.event(
          accountId,
          'legacy_conversion',
          account.openingBalance,
          base,
          { kind: account.openingBalance ? 'legacy' : 'unknown' },
          basis,
          'Conversão de correções do backup antigo',
          id,
        );
        event.details = {
          knownSameDayIds: await this.repo.knownDateIds(accountId, date),
          legacyCorrections: legacy.map((t) => ({
            id: t.id,
            amount: t.amount,
            date: t.transactionDate,
            adjustment: t.balanceAdjustment,
          })),
        };
        await this.repo.append(event);
      }
      await this.repo.write(accountId, base, basis);
    }
  }
}
