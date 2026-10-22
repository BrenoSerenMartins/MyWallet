import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { CreateWorkspaceDto, WorkspaceResourceDto } from '../dto/workspace.dto.js';
@Injectable()
export class WorkspacesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async ensureDefault() {
    await this.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'workspace-default:' + this.db.userId,
    ]);
    await this.db.query(
      "INSERT INTO wallet.workspaces(user_id,name,description,is_default) VALUES($1,'Pessoal','Minhas finanças pessoais',true) ON CONFLICT(user_id) WHERE is_default DO NOTHING",
      [this.db.userId],
    );
  }
  list(): Promise<WorkspaceResourceDto[]> {
    return this.db.query(
      'SELECT id,name,description,color,is_default AS "isDefault" FROM wallet.workspaces WHERE user_id=$1 ORDER BY is_default DESC,created_at,id',
      [this.db.userId],
    );
  }
  async create(input: CreateWorkspaceDto) {
    const [result] = await this.db.query(
      'INSERT INTO wallet.workspaces(id,user_id,name,description,color) VALUES($1,$2,$3,$4,$5) RETURNING id,name,description,color,is_default AS "isDefault"',
      [randomUUID(), this.db.userId, input.name.trim(), input.description.trim(), input.color],
    );
    return result;
  }
}
