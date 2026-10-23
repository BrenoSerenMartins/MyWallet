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
    const groupId = record.groupId ?? (await this.defaultGroup(record.type)).id;
    const existing = (await this.list()).find(
      (c) => c.name === record.name && c.type === record.type && c.groupId === groupId,
    );
    return existing?.id ?? ((await this.repository.save({ ...record, groupId })).id as string);
  }
  list(includeArchived = false) {
    return this.repository.list(includeArchived);
  }
  async save(input: CategoryDto) {
    const groupId = input.groupId ?? (await this.defaultGroup(input.type)).id;
    const category = { ...input, groupId };
    await this.validateGroup(category);
    return this.repository.save(category);
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
    updated.groupId ??= (await this.defaultGroup(updated.type)).id;
    await this.validateGroup(updated);
    return this.repository.save(updated, id);
  }
  exportGroups() {
    return this.repository.groups();
  }
  async restoreGroupRecord(
    record: import('../../../core/integration/index.js').CategoryGroupResource,
  ) {
    if (record.isDefault) return (await this.defaultGroup(record.type)).id;
    const existing = (await this.exportGroups()).find(
      (g) => g.name === record.name && g.type === record.type,
    );
    return existing?.id ?? (await this.repository.saveGroup(record)).id;
  }
  async saveGroup(input: CategoryGroupDto, id?: string) {
    if (id) {
      const existing = (await this.exportGroups()).find((g) => g.id === id);
      if (!existing) throw new NotFoundException('Grupo não encontrado.');
      if (existing.isDefault && existing.name !== input.name.trim())
        throw new ConflictException('O grupo padrão não pode ser renomeado.');
      if (existing.type !== input.type)
        throw new ConflictException('O tipo do grupo não pode ser alterado.');
    }
    return this.repository.saveGroup(input, id);
  }
  private async defaultGroup(type: string) {
    const group = (await this.exportGroups()).find(
      (group) => group.type === type && group.isDefault,
    );
    if (!group) throw new ConflictException('Grupo padrão indisponível neste espaço.');
    return group;
  }
  async deletionPreview(id: string) {
    const group = (await this.exportGroups()).find((group) => group.id === id);
    if (!group) throw new NotFoundException('Grupo não encontrado.');
    if (group.isDefault) throw new ConflictException('O grupo padrão não pode ser excluído.');
    const destination = await this.defaultGroup(group.type);
    const categories = await this.list(true);
    const affected = categories.filter((category) => category.groupId === id);
    const destinationNames = new Set(
      categories
        .filter((category) => category.groupId === destination.id)
        .map((category) => category.name),
    );
    return {
      id,
      name: group.name,
      categoryCount: affected.length,
      destinationGroupId: destination.id,
      destinationGroupName: destination.name,
      conflictingNames: affected
        .filter((category) => destinationNames.has(category.name))
        .map((category) => category.name),
    };
  }
  async deleteGroup(id: string) {
    const initial = await this.deletionPreview(id);
    await this.repository.lockGroups([id, initial.destinationGroupId]);
    const preview = await this.deletionPreview(id);
    if (preview.conflictingNames.length)
      throw new ConflictException(
        'Existem categorias com o mesmo nome no grupo padrão. Renomeie ou mova essas categorias antes de excluir o grupo.',
      );
    const movedCategories = await this.repository.moveCategoriesAndDeleteGroup(
      id,
      preview.destinationGroupId,
    );
    return { id, deleted: true, movedCategories, destinationGroupId: preview.destinationGroupId };
  }
  private async validateGroup(input: CategoryDto) {
    if (!input.groupId) return;
    if (!(await this.exportGroups()).some((g) => g.id === input.groupId && g.type === input.type))
      throw new UnprocessableEntityException('Grupo incompatível ou fora deste espaço.');
  }
  async archive(id: string) {
    const category = (await this.list(true)).find((category) => category.id === id);
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    await this.repository.archive(id);
    return { id, archived: true };
  }
  async validate(id: string, type: string) {
    if (!(await this.list()).some((c) => c.id === id && c.type === type))
      throw new UnprocessableEntityException('Categoria incompatível com o lançamento.');
  }
}
