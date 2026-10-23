import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { CategoryDto, CategoryGroupDto } from '../dto/category.dto.js';
import type { CategoryResource, CategoryGroupResource } from '../../../core/integration/index.js';
@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async list(includeArchived = false): Promise<CategoryResource[]> {
    return this.db.query(
      `SELECT c.id,c.name,c.type,c.color,c.archived_at IS NOT NULL AS archived,c.group_id AS "groupId",g.name AS "groupName" FROM wallet.categories c LEFT JOIN wallet.category_groups g ON g.id=c.group_id WHERE c.user_id=$1 AND (c.archived_at IS NULL OR $2) ORDER BY g.name NULLS LAST,c.name,c.id`,
      [this.db.userId, includeArchived],
    );
  }
  async groups(): Promise<CategoryGroupResource[]> {
    return this.db.query(
      'SELECT id,name,type,color,is_default AS "isDefault" FROM wallet.category_groups WHERE user_id=$1 ORDER BY is_default,name,id',
      [this.db.userId],
    );
  }
  async lockGroups(ids: string[]) {
    await this.db.query(
      'SELECT id FROM wallet.category_groups WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',
      [this.db.userId, ids],
    );
  }
  async moveCategoriesAndDeleteGroup(id: string, destinationId: string) {
    const rows = await this.db.query(
      'UPDATE wallet.categories SET group_id=$3 WHERE user_id=$1 AND group_id=$2 RETURNING id',
      [this.db.userId, id, destinationId],
    );
    await this.db.query(
      'DELETE FROM wallet.category_groups WHERE user_id=$1 AND id=$2 AND NOT is_default',
      [this.db.userId, id],
    );
    return rows.length;
  }
  async saveGroup(input: CategoryGroupDto, id: string = randomUUID()) {
    const [group] = await this.db.query(
      'INSERT INTO wallet.category_groups(id,user_id,name,type,color) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color WHERE category_groups.user_id=$2 RETURNING id,name,type,color,is_default AS "isDefault"',
      [id, this.db.userId, input.name.trim(), input.type, input.color],
    );
    return group;
  }
  async save(input: CategoryDto, id: string = randomUUID()) {
    const rows = await this.db.query(
      `INSERT INTO wallet.categories(id,user_id,name,type,color,group_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,group_id=EXCLUDED.group_id WHERE categories.user_id=$2 RETURNING id,name,type,color,group_id AS "groupId"`,
      [id, this.db.userId, input.name.trim(), input.type, input.color, input.groupId ?? null],
    );
    return rows[0];
  }
}
