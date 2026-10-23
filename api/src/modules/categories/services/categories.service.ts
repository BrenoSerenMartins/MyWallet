import {
  Inject,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { CategoryReads } from '../../../core/integration/index.js';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import type { CategoryDto, CategoryGroupDto } from '../dto/category.dto.js';
@Injectable()
export class CategoriesService implements CategoryReads {
  constructor(@Inject(CategoriesRepository) private readonly repository: CategoriesRepository) {}
  async exportRecords() {
    return this.repository.list(true);
  }
  async restoreRecord(record: import('../../../core/integration/index.js').BackupCategory) {
    const existing = (await this.list()).find(
      (c) =>
        c.name === record.name &&
        c.type === record.type &&
        (c.groupId ?? null) === (record.groupId ?? null),
    );
    return existing?.id ?? ((await this.repository.save(record)).id as string);
  }
  list(includeArchived = false) {
    return this.repository.list(includeArchived);
  }
  async save(input: CategoryDto) {
    await this.validateGroup(input);
    return this.repository.save(input);
  }
  async update(id: string, input: CategoryDto) {
    const existing = (await this.list()).find((c) => c.id === id);
    if (!existing) throw new NotFoundException('Categoria não encontrada.');
    if (existing.type !== input.type)
      throw new ConflictException('O tipo de uma categoria existente não pode ser substituído.');
    const updated = {
      ...input,
      groupId: input.groupId === undefined ? existing.groupId : input.groupId,
    };
    await this.validateGroup(updated);
    return this.repository.save(updated, id);
  }
  exportGroups() {
    return this.repository.groups();
  }
  async restoreGroupRecord(
    record: import('../../../core/integration/index.js').CategoryGroupResource,
  ) {
    const existing = (await this.exportGroups()).find(
      (g) => g.name === record.name && g.type === record.type,
    );
    return existing?.id ?? (await this.repository.saveGroup(record)).id;
  }
  async saveGroup(input: CategoryGroupDto, id?: string) {
    if (id) {
      const existing = (await this.exportGroups()).find((g) => g.id === id);
      if (!existing) throw new NotFoundException('Grupo não encontrado.');
      if (existing.type !== input.type)
        throw new ConflictException('O tipo do grupo não pode ser alterado.');
    }
    return this.repository.saveGroup(input, id);
  }
  private async validateGroup(input: CategoryDto) {
    if (!input.groupId) return;
    if (!(await this.exportGroups()).some((g) => g.id === input.groupId && g.type === input.type))
      throw new UnprocessableEntityException('Grupo incompatível ou fora deste espaço.');
  }
  async validate(id: string, type: string) {
    if (!(await this.list()).some((c) => c.id === id && c.type === type))
      throw new UnprocessableEntityException('Categoria incompatível com o lançamento.');
  }
}
