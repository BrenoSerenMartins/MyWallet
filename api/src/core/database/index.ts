import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type QueryResultRow } from 'pg';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { requireUuid } from '../rest/index.js';
import { Configuration } from '../config/index.js';
import { databaseReadinessFailure } from './readiness-failure.js';
export interface SqlConnection {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
interface UserTransaction {
  userId: string;
  workspaceId: string | null;
  connection: SqlConnection;
  rollbackOnly?: Error;
}
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;
  private readonly logger = new Logger(DatabaseService.name);
  private readinessState: string | undefined;
  private readonly requestedWorkspace = new AsyncLocalStorage<string | undefined>();
  withWorkspace(id: string | undefined, next: () => void) {
    this.requestedWorkspace.run(id, next);
  }
  private readonly scope = new AsyncLocalStorage<UserTransaction>();
  constructor(@Inject(Configuration) configuration: Configuration) {
    this.pool = configuration.databaseUrl
      ? new Pool({
          connectionString: configuration.databaseUrl,
          max: 5,
          ssl: configuration.ssl,
          connectionTimeoutMillis: 8000,
          statement_timeout: 15000,
        })
      : null;
    this.pool?.on('error', () => console.error('An idle database connection failed.'));
  }
  get userId(): string {
    const scope = this.scope.getStore();
    if (!scope) throw new Error('A verified user transaction is required.');
    return scope.userId;
  }
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    const scope = this.scope.getStore();
    if (!scope) throw new Error('Unscoped database access is forbidden.');
    return (await scope.connection.query<T>(sql, values)).rows;
  }
  async forUser<T>(
    userId: string,
    action: () => Promise<T>,
    readOnly = false,
    workspaceId?: string | null,
  ): Promise<T> {
    const current = this.scope.getStore();
    const selected =
      workspaceId === undefined
        ? current
          ? current.workspaceId
          : this.requestedWorkspace.getStore()
        : workspaceId;
    if (current) {
      if (current.userId !== userId || current.workspaceId !== selected)
        throw new Error('Cannot change transaction owner.');
      try {
        return await action();
      } catch (error) {
        current.rollbackOnly =
          error instanceof Error ? error : new Error('Nested transaction failed.');
        throw error;
      }
    }
    if (!this.pool) throw new Error('RUNTIME_DATABASE_URL is not configured.');
    const connection = await this.pool.connect();
    try {
      const identity = await connection.query(
        'SELECT current_user AS role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
      );
      if (
        identity.rows[0]?.role !== 'mywallet_runtime' ||
        identity.rows[0]?.rolsuper ||
        identity.rows[0]?.rolbypassrls
      )
        throw new Error('API requires the restricted mywallet_runtime database role.');
      await connection.query(
        readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN',
      );
      await connection.query("SELECT set_config('wallet.user_id', $1, true)", [userId]);
      if (selected !== null) {
        if (!selected) throw new BadRequestException('Selecione um espaço para continuar.');
        requireUuid(selected);
        const access = await connection.query(
          `SELECT id FROM wallet.workspaces w WHERE user_id=$1 AND id=$2 AND to_jsonb(w)->>'deleted_at' IS NULL ${readOnly ? '' : 'FOR SHARE'}`,
          [userId, selected],
        );
        if (!access.rows.length) throw new NotFoundException('Espaço não encontrado.');
        await connection.query("SELECT set_config('wallet.workspace_id',$1,true)", [selected]);
      }
      const context: UserTransaction = { userId, connection, workspaceId: selected ?? null };
      const result = await this.scope.run(context, action);
      if (context.rollbackOnly) throw context.rollbackOnly;
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }
  async ready(): Promise<boolean> {
    if (!this.pool) return this.recordReadiness('RUNTIME_DATABASE_URL_MISSING');
    try {
      const r = await this.pool.query(
        'SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
      );
      const role = r.rows[0];
      return this.recordReadiness(
        role?.rolname === 'mywallet_runtime' && !role.rolsuper && !role.rolbypassrls
          ? 'READY'
          : 'RUNTIME_ROLE_INVALID',
      );
    } catch (error) {
      return this.recordReadiness(databaseReadinessFailure(error));
    }
  }
  private recordReadiness(state: string): boolean {
    if (state !== this.readinessState) {
      if (state === 'READY') this.logger.log('Database readiness: READY.');
      else this.logger.warn(`Database readiness failed: ${state}.`);
      this.readinessState = state;
    }
    return state === 'READY';
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
}
@Global()
@Module({ providers: [Configuration, DatabaseService], exports: [Configuration, DatabaseService] })
export class DatabaseModule {}
