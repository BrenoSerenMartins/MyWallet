import { requireVersion } from '../../../core/rest/index.js';
import type { CounterpartyRelationDto, ToggleRuleDto } from '../dto/counterparty.dto.js';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ACCOUNT_READS,
  CATEGORY_READS,
  type AccountReads,
  type CategoryReads,
  type CounterpartyRules,
  type CounterpartySnapshot,
  type SourceKind,
  type TransactionInput,
} from '../../../core/integration/index.js';
import { CounterpartiesRepository } from '../repositories/counterparties.repository.js';
import {
  isSpecificCounterpartyIdentifier,
  normalizeCounterpartyIdentifier,
} from '../../../core/integration/index.js';
@Injectable()
export class CounterpartiesService implements CounterpartyRules {
  constructor(
    @Inject(CounterpartiesRepository) private readonly repository: CounterpartiesRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
  ) {}
  async snapshot() {
    return {
      agents: await this.repository.agents(),
      identifiers: await this.repository.identifiers(),
      rules: await this.repository.rules(),
    };
  }
  async list() {
    const state = await this.snapshot();
    return state.agents.map((agent) => ({
      ...agent,
      identifiers: state.identifiers.filter((i) => i.counterpartyId === agent.id),
      rules: state.rules.filter((r) => r.counterpartyId === agent.id),
    }));
  }
  async find(id: string) {
    const agent = (await this.repository.agents()).find((agent) => agent.id === id);
    if (!agent) throw new NotFoundException('Agente não encontrado.');
    return agent;
  }
  async create(name: string) {
    if (!name.trim()) throw new UnprocessableEntityException('Informe o nome do agente.');
    return this.repository.create(name.trim());
  }
  async update(id: string, name: string, enabled: boolean, version: number) {
    await this.find(id);
    if (!name.trim()) throw new UnprocessableEntityException('Informe o nome do agente.');
    if (!(await this.repository.update(id, name.trim(), enabled, version)).length)
      throw new ConflictException('O agente mudou. Atualize a página.');
    return this.find(id);
  }
  async removeIdentifier(agent: string, id: string) {
    await this.find(agent);
    if (!(await this.repository.removeIdentifier(id, agent)).length)
      throw new NotFoundException('Identificação não encontrada.');
    return { id };
  }
  async toggleRule(id: string, enabled: boolean, version: number) {
    if (!(await this.repository.toggleRule(id, enabled, version)).length)
      throw new ConflictException('A regra mudou ou não existe neste espaço.');
    return { id };
  }
  async findRule(id: string) {
    const rule = (await this.repository.rules()).find((rule) => rule.id === id);
    if (!rule) throw new NotFoundException('Regra não encontrada.');
    return rule;
  }
  async configureRule(id: string, input: ToggleRuleDto, version: number) {
    const rule = await this.findRule(id);
    requireVersion(rule.version, version);
    if (input.categoryId) {
      await this.categories.validate(input.categoryId, rule.transactionType);
      await this.repository.saveRule(
        rule.counterpartyId,
        rule.accountId,
        rule.transactionType,
        input.categoryId,
        input.enabled,
      );
    } else await this.toggleRule(id, input.enabled, version);
  }
  async relate(agentId: string, input: CounterpartyRelationDto) {
    const agent = await this.find(agentId);
    const account = await this.accounts.find(input.accountId, true);
    if (
      !agent.enabled ||
      account.archived ||
      !isSpecificCounterpartyIdentifier(input.value, input.identifierKind) ||
      (input.identifierKind === 'store_id' && input.sourceKind !== 'settlement')
    )
      throw new UnprocessableEntityException(
        'Escolha um agente e uma conta ativos e uma descrição específica.',
      );
    await this.categories.validate(input.categoryId, input.transactionType);
    if (
      !(await this.repository.addIdentifier(
        agentId,
        input.accountId,
        input.sourceKind,
        input.value,
        normalizeCounterpartyIdentifier(input.value, input.identifierKind),
        true,
        true,
        input.identifierKind,
      ))
    )
      throw new ConflictException(
        'Essa identificação pertence a outro agente. Revise os vínculos antes de alterar.',
      );
    return this.repository.saveRule(
      agentId,
      input.accountId,
      input.transactionType,
      input.categoryId,
    );
  }
  async suggest(
    accountId: string,
    sourceKind: SourceKind,
    entries: Pick<
      TransactionInput,
      | 'description'
      | 'transactionType'
      | 'categoryId'
      | 'counterpartyId'
      | 'counterpartyName'
      | 'sourceStoreId'
    >[],
  ) {
    const state = await this.snapshot();
    const categories = await this.categories.list();
    const activeAgents = new Set(state.agents.filter((a) => a.enabled).map((a) => a.id));
    const aliases = new Map(
      state.identifiers
        .filter(
          (i) =>
            i.enabled &&
            i.accountId === accountId &&
            i.sourceKind === sourceKind &&
            activeAgents.has(i.counterpartyId),
        )
        .map((i) => [
          `${i.identifierKind ?? 'description'}:${normalizeCounterpartyIdentifier(i.value, i.identifierKind)}`,
          i.counterpartyId,
        ]),
    );
    const usableCategories = new Set(
      categories
        .filter((category) => !category.archived)
        .map((category) => `${category.id}:${category.type}`),
    );
    const rules = new Map(
      state.rules
        .filter(
          (rule) =>
            rule.enabled &&
            rule.accountId === accountId &&
            activeAgents.has(rule.counterpartyId) &&
            usableCategories.has(`${rule.categoryId}:${rule.transactionType}`),
        )
        .map((rule) => [`${rule.counterpartyId}:${rule.transactionType}`, rule]),
    );
    return entries.map((entry) => {
      const matched = new Set<string>();
      if (isSpecificCounterpartyIdentifier(entry.description)) {
        const agent = aliases.get(
          `description:${normalizeCounterpartyIdentifier(entry.description)}`,
        );
        if (agent) matched.add(agent);
      }
      if (entry.sourceStoreId && sourceKind === 'settlement') {
        const agent = aliases.get(`store_id:${entry.sourceStoreId.trim()}`);
        if (agent) matched.add(agent);
      }
      const counterpartyId = entry.counterpartyName
        ? null
        : entry.counterpartyId !== undefined
          ? entry.counterpartyId
          : matched.size === 1
            ? [...matched][0]
            : null;
      const rule = rules.get(`${counterpartyId}:${entry.transactionType}`);
      const apply = !entry.categoryId && !!rule;
      return {
        counterpartyId,
        categoryId: apply ? rule.categoryId : (entry.categoryId ?? null),
        classificationRuleId: apply ? rule.id : null,
      };
    });
  }
  async resolve(input: TransactionInput, automatic: boolean) {
    if (
      input.balanceAdjustment ||
      input.refundOfId ||
      input.transferGroupId ||
      !['income', 'expense'].includes(input.transactionType)
    ) {
      if (input.rememberCategory || input.counterpartyName)
        throw new UnprocessableEntityException(
          'Regras de categoria são para receitas e despesas comuns.',
        );
      return input;
    }
    const sourceKind = input.sourceKind ?? 'manual';
    const counterpartyId = await this.selectCounterparty({ ...input, sourceKind }, automatic);
    let resolved = {
      ...input,
      sourceKind,
      counterpartyId,
      categoryId: input.categoryId ?? null,
      classificationRuleId: input.classificationRuleId ?? null,
    };
    if (input.rememberCategory) {
      if (!counterpartyId || !input.categoryId)
        throw new UnprocessableEntityException(
          'Escolha um agente e uma categoria para lembrar esta relação.',
        );
      const id = await this.relate(counterpartyId, {
        accountId: input.accountId,
        sourceKind,
        value:
          input.sourceStoreId && sourceKind === 'settlement'
            ? input.sourceStoreId
            : input.description,
        identifierKind:
          input.sourceStoreId && sourceKind === 'settlement' ? 'store_id' : 'description',
        transactionType: input.transactionType as 'income' | 'expense',
        categoryId: input.categoryId,
      });
      resolved = { ...resolved, classificationRuleId: id };
    }
    return automatic ? this.applyAutomaticCategory(resolved) : resolved;
  }
  private async selectCounterparty(input: TransactionInput, automatic: boolean) {
    if (input.counterpartyName?.trim()) {
      if (input.counterpartyId)
        throw new UnprocessableEntityException('Escolha um agente existente ou crie outro.');
      return (await this.create(input.counterpartyName)).id;
    }
    if (input.counterpartyId) {
      await this.find(input.counterpartyId);
      return input.counterpartyId;
    }
    if (
      input.counterpartyId !== undefined ||
      !automatic ||
      (!isSpecificCounterpartyIdentifier(input.description) && !input.sourceStoreId)
    )
      return null;
    const matches = new Set<string>();
    if (isSpecificCounterpartyIdentifier(input.description)) {
      const id = await this.repository.identify(
        input.accountId,
        input.sourceKind ?? 'manual',
        normalizeCounterpartyIdentifier(input.description),
      );
      if (id) matches.add(id);
    }
    if (input.sourceStoreId && input.sourceKind === 'settlement') {
      const id = await this.repository.identify(
        input.accountId,
        'settlement',
        input.sourceStoreId.trim(),
        'store_id',
      );
      if (id) matches.add(id);
    }
    return matches.size === 1 ? [...matches][0] : null;
  }
  private async applyAutomaticCategory(input: TransactionInput) {
    if (
      input.categoryId ||
      !input.counterpartyId ||
      !(await this.find(input.counterpartyId)).enabled
    )
      return input;
    const rule = await this.repository.rule(
      input.counterpartyId,
      input.accountId,
      input.transactionType,
    );
    return rule ? { ...input, categoryId: rule.categoryId, classificationRuleId: rule.id } : input;
  }
  async observe(
    counterpartyId: string,
    accountId: string,
    sourceKind: SourceKind,
    description: string,
    storeId?: string,
  ) {
    if (!(await this.find(counterpartyId)).enabled) return;
    if (isSpecificCounterpartyIdentifier(description))
      await this.repository.addIdentifier(
        counterpartyId,
        accountId,
        sourceKind,
        description,
        normalizeCounterpartyIdentifier(description),
      );
    if (
      storeId &&
      sourceKind === 'settlement' &&
      isSpecificCounterpartyIdentifier(storeId, 'store_id')
    )
      await this.repository.addIdentifier(
        counterpartyId,
        accountId,
        sourceKind,
        storeId,
        storeId.trim(),
        true,
        false,
        'store_id',
      );
  }
  async restore(
    snapshot: CounterpartySnapshot,
    accounts: Map<string, string>,
    categories: Map<string, string>,
  ) {
    const agents = new Map<string, string>(),
      rules = new Map<string, string>();
    for (const a of snapshot.agents)
      agents.set(a.id, (await this.repository.create(a.name, a.enabled)).id);
    for (const i of snapshot.identifiers)
      await this.repository.addIdentifier(
        agents.get(i.counterpartyId)!,
        accounts.get(i.accountId)!,
        i.sourceKind,
        i.value,
        normalizeCounterpartyIdentifier(i.value, i.identifierKind),
        i.enabled,
        true,
        i.identifierKind,
      );
    for (const r of snapshot.rules)
      rules.set(
        r.id,
        await this.repository.saveRule(
          agents.get(r.counterpartyId)!,
          accounts.get(r.accountId)!,
          r.transactionType,
          categories.get(r.categoryId)!,
          r.enabled,
        ),
      );
    return { agents, rules };
  }
}
