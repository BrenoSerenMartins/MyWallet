import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type QueryResultRow } from 'pg';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
  actorId: string;
  role: string;
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
  private readonly requestedReadOnly = new AsyncLocalStorage<boolean>();
  withWorkspace(id: string | undefined, next: () => void, readOnly = false) {
    this.requestedReadOnly.run(readOnly, () => this.requestedWorkspace.run(id, next));
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
  get actorId(): string {
    const scope = this.scope.getStore();
    if (!scope) throw new Error('A verified actor is required.');
    return scope.actorId;
  }
  requireOwner() {
    if (this.scope.getStore()?.role !== 'owner')
      throw new ForbiddenException('Apenas o proprietário pode executar esta ação.');
  }
  requireExport() {
    if (this.scope.getStore()?.role === 'reader')
      throw new ForbiddenException('Seu acesso permite apenas consultar este espaço.');
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
    personal = false,
  ): Promise<T> {
    if (workspaceId !== null && this.requestedReadOnly.getStore()) readOnly = true;
    const current = this.scope.getStore();
    const selected =
      workspaceId === undefined
        ? current
          ? current.workspaceId
          : this.requestedWorkspace.getStore()
        : workspaceId;
    if (current) {
      if (current.actorId !== userId || current.workspaceId !== selected)
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
        identity.rows[0]?.role !== 'plannedwallet_runtime' ||
        identity.rows[0]?.rolsuper ||
        identity.rows[0]?.rolbypassrls
      )
        throw new Error('API requires the restricted plannedwallet_runtime database role.');
      await connection.query(
        readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN',
      );
      await connection.query("SELECT set_config('wallet.actor_id',$1,true)", [userId]);
      await connection.query("SELECT set_config('wallet.user_id', $1, true)", [userId]);
      let ownerId = userId,
        role = 'owner';
      if (selected !== null) {
        if (!selected) throw new BadRequestException('Selecione um espaço para continuar.');
        requireUuid(selected);
        const access = await connection.query('SELECT * FROM wallet.resolve_workspace($1,$2)', [
          selected,
          !readOnly && !personal,
        ]);
        if (!access.rows.length) {
          const readable = await connection.query(
            'SELECT * FROM wallet.resolve_workspace($1,false)',
            [selected],
          );
          if (readable.rows.length)
            throw new ForbiddenException('Seu acesso permite apenas consultar este espaço.');
          throw new NotFoundException('Espaço não encontrado.');
        }
        ownerId = access.rows[0].owner_id;
        role = access.rows[0].member_role;
        await connection.query("SELECT set_config('wallet.user_id',$1,true)", [ownerId]);
        await connection.query("SELECT set_config('wallet.workspace_id',$1,true)", [selected]);
      }
      const context: UserTransaction = {
        userId: ownerId,
        actorId: userId,
        role,
        connection,
        workspaceId: selected ?? null,
      };
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
        role?.rolname === 'plannedwallet_runtime' && !role.rolsuper && !role.rolbypassrls
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
