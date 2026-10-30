import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type {
  CreateWorkspaceDto,
  WorkspaceResourceDto,
  TrashedWorkspaceResourceDto,
} from '../dto/workspace.dto.js';
@Injectable()
export class WorkspacesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async lockOwner() {
    await this.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'workspace-default:' + this.db.userId,
    ]);
  }
  async purgeExpired() {
    await this.db.query('SELECT wallet.purge_my_expired_workspaces()');
  }
  async ensureDefault() {
    await this.lockOwner();
    await this.db.query(
      `INSERT INTO wallet.workspaces(user_id,name,description,is_default)
      SELECT $1,'Pessoal','Minhas finanças pessoais',true WHERE NOT EXISTS(SELECT 1 FROM wallet.workspaces WHERE user_id=$1)
      ON CONFLICT(user_id) WHERE is_default DO NOTHING`,
      [this.db.userId],
    );
    await this.promoteDefault();
  }
  async promoteDefault() {
    await this.db.query(
      `UPDATE wallet.workspaces SET is_default=true WHERE id=(
      SELECT id FROM wallet.workspaces WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1)
      AND NOT EXISTS(SELECT 1 FROM wallet.workspaces WHERE user_id=$1 AND is_default)`,
      [this.db.userId],
    );
  }
  async lock(id: string) {
    const [row] = await this.db.query(
      'SELECT id,deleted_at FROM wallet.workspaces WHERE user_id=$1 AND id=$2 FOR UPDATE',
      [this.db.userId, id],
    );
    return row;
  }
  async trash(): Promise<TrashedWorkspaceResourceDto[]> {
    const rows = await this.db.query(
      `SELECT id,name,description,color,is_default AS "isDefault",deleted_at::text AS "deletedAt",
      (deleted_at+interval '168 hours')::text AS "deleteAfter" FROM wallet.workspaces
      WHERE user_id=$1 AND deleted_at IS NOT NULL AND deleted_at>clock_timestamp()-interval '168 hours' ORDER BY deleted_at DESC,id`,
      [this.db.userId],
    );
    return rows.map((row) => ({
      ...row,
      deletedAt: new Date(row.deletedAt).toISOString(),
      deleteAfter: new Date(row.deleteAfter).toISOString(),
    })) as TrashedWorkspaceResourceDto[];
  }
  async archive(id: string) {
    await this.db.query(
      'UPDATE wallet.workspaces SET deleted_at=coalesce(deleted_at,clock_timestamp()),is_default=false WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
    await this.promoteDefault();
    return (await this.trash()).find((workspace) => workspace.id === id);
  }
  async restore(id: string) {
    const rows = await this.db.query(
      `UPDATE wallet.workspaces SET deleted_at=NULL WHERE user_id=$1 AND id=$2
      AND deleted_at>clock_timestamp()-interval '168 hours' RETURNING id`,
      [this.db.userId, id],
    );
    if (!rows.length) return null;
    await this.promoteDefault();
    return (await this.list()).find((workspace) => workspace.id === id)!;
  }
  list(): Promise<WorkspaceResourceDto[]> {
    return this.db.query(
      'SELECT id,name,description,color,is_default AS "isDefault" FROM wallet.workspaces WHERE user_id=$1 AND deleted_at IS NULL ORDER BY is_default DESC,created_at,id',
      [this.db.userId],
    );
  }
  async create(input: CreateWorkspaceDto) {
    await this.lockOwner();
    const [result] = await this.db.query(
      'INSERT INTO wallet.workspaces(id,user_id,name,description,color,is_default) VALUES($1,$2,$3,$4,$5,NOT EXISTS(SELECT 1 FROM wallet.workspaces WHERE user_id=$2 AND is_default)) RETURNING id,name,description,color,is_default AS "isDefault"',
      [randomUUID(), this.db.userId, input.name.trim(), input.description.trim(), input.color],
    );
    return result;
  }
}
