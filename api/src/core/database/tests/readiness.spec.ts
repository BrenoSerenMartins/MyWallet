import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../index.js';

function database(query?: ReturnType<typeof vi.fn>) {
  const service = new DatabaseService({ databaseUrl: '', ssl: false } as never);
  if (query) (service as unknown as { pool: unknown }).pool = { query };
  return service;
}

afterEach(() => vi.restoreAllMocks());

describe('Database readiness diagnostics', () => {
  it('reports missing runtime configuration once and remains unavailable', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const service = database();
    expect(await service.ready()).toBe(false);
    expect(await service.ready()).toBe(false);
    expect(warn.mock.calls).toEqual([['Database readiness failed: RUNTIME_DATABASE_URL_MISSING.']]);
  });

  it('logs an allowed failure code without connection details and reports recovery', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const query = vi.fn().mockRejectedValue(
      Object.assign(new Error('password=private-token postgresql://private-url'), {
        code: '28P01',
      }),
    );
    const service = database(query);
    expect(await service.ready()).toBe(false);
    expect(await service.ready()).toBe(false);
    expect(warn.mock.calls).toEqual([['Database readiness failed: 28P01.']]);
    query.mockResolvedValue({
      rows: [{ rolname: 'mywallet_runtime', rolsuper: false, rolbypassrls: false }],
    });
    expect(await service.ready()).toBe(true);
    expect(log).toHaveBeenCalledWith('Database readiness: READY.');
  });

  it('rejects elevated database identities', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    for (const role of [
      { rolname: 'postgres', rolsuper: true, rolbypassrls: true },
      { rolname: 'mywallet_runtime', rolsuper: false, rolbypassrls: true },
    ]) {
      expect(await database(vi.fn().mockResolvedValue({ rows: [role] })).ready()).toBe(false);
    }
    expect(warn).toHaveBeenCalledWith('Database readiness failed: RUNTIME_ROLE_INVALID.');
  });

  it('does not log unknown error codes, messages or stacks', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const query = vi.fn().mockRejectedValue({ code: 'private-token', message: 'private-url' });
    expect(await database(query).ready()).toBe(false);
    expect(warn.mock.calls).toEqual([['Database readiness failed: CONNECTION_FAILED.']]);
  });

  it.each(['SELF_SIGNED_CERT_IN_CHAIN', 'ENETUNREACH'])(
    'identifies %s without logging certificate or connection contents',
    async (code) => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const query = vi.fn().mockRejectedValue({ code, message: 'private connection details' });
      expect(await database(query).ready()).toBe(false);
      expect(warn.mock.calls).toEqual([[`Database readiness failed: ${code}.`]]);
    },
  );
});
