import {
  Inject,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { CategoryReads } from '../../../core/integration/index.js';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import type { CategoryDto } from '../dto/category.dto.js';
@Injectable()
export class CategoriesService implements CategoryReads {
  constructor(@Inject(CategoriesRepository) private readonly repository: CategoriesRepository) {}
  async exportRecords() {
    return this.repository.list(true);
  }
  async restoreRecord(record: import('../../../core/integration/index.js').BackupCategory) {
    const existing = (await this.list()).find(
      (c) => c.name === record.name && c.type === record.type,
    );
    return existing?.id ?? ((await this.repository.save(record)).id as string);
  }
  list(includeArchived = false) {
    return this.repository.list(includeArchived);
  }
  save(input: CategoryDto) {
    return this.repository.save(input);
  }
  async update(id: string, input: CategoryDto) {
    const existing = (await this.list()).find((c) => c.id === id);
    if (!existing) throw new NotFoundException('Categoria não encontrada.');
    if (existing.type !== input.type)
      throw new ConflictException('O tipo de uma categoria existente não pode ser substituído.');
    return this.repository.save(input, id);
  }
  async validate(id: string, type: string) {
    if (!(await this.list()).some((c) => c.id === id && c.type === type))
      throw new UnprocessableEntityException('Categoria incompatível com o lançamento.');
  }
}
