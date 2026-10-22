import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/core/database/index.js';
export class TestDatabase {
  readonly engine = new PGlite();
  readonly user = randomUUID();
  readonly other = randomUUID();
  readonly service: DatabaseService;
  constructor() {
    this.service = new DatabaseService({ databaseUrl: '', ssl: false } as never);
  }
  async initialize() {
    await this.engine.exec('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);');
    await this.engine.query('INSERT INTO auth.users VALUES($1),($2)', [this.user, this.other]);
    for (const file of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await this.engine.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
    const engine = this.engine;
    const pool = {
      connect: async () => ({
        query: async (sql: string, values?: unknown[]) => engine.query(sql, values),
        release: () => {},
      }),
    };
    (this.service as unknown as { pool: unknown }).pool = pool;
  }
  async forUser<T>(
    user: string,
    action: () => Promise<T>,
    readOnly = false,
    workspaceId?: string | null,
  ) {
    if (workspaceId === undefined) {
      const r = await this.engine.query<{ id: string }>(
        'SELECT id FROM wallet.workspaces WHERE user_id=$1 AND is_default',
        [user],
      );
      workspaceId = r.rows[0].id;
    }
    await this.engine.exec('SET ROLE mywallet_runtime');
    try {
      return await this.service.forUser(user, action, readOnly, workspaceId);
    } finally {
      await this.engine.exec('RESET ROLE');
    }
  }
  async close() {
    await this.engine.close();
  }
}
