import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { CategoryDto } from '../dto/category.dto.js';
import type { CategoryResource } from '../../../core/integration/index.js';
@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async list(): Promise<CategoryResource[]> {
    return this.db.query(
      'SELECT id,name,type,color FROM wallet.categories WHERE user_id=$1 AND archived_at IS NULL ORDER BY name,id',
      [this.db.userId],
    );
  }
  async save(input: CategoryDto, id: string = randomUUID()) {
    const rows = await this.db.query(
      'INSERT INTO wallet.categories(id,user_id,name,type,color) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color WHERE categories.user_id=$2 RETURNING id,name,type,color',
      [id, this.db.userId, input.name.trim(), input.type, input.color],
    );
    return rows[0];
  }
}
