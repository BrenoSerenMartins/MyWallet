import 'reflect-metadata';
import { Logger, type ArgumentsHost } from '@nestjs/common';
import { afterEach, expect, it, vi } from 'vitest';
import { SafeErrorFilter } from '../index.js';

afterEach(() => vi.restoreAllMocks());

it('records a server error code and request reference without leaking database details', () => {
  const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  const response = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn(),
    getHeader: () => 'synthetic-request-id',
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ path: '/v1/imports/synthetic/confirmations' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  new SafeErrorFilter().catch(
    Object.assign(new Error('private SQL, merchant name and connection password'), {
      code: '57014',
      detail: 'private parameters',
    }),
    host,
  );
  expect(logger.mock.calls).toEqual([
    ['Request failed: code=57014; requestId=synthetic-request-id.'],
  ]);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(response.json.mock.calls[0][0]).toMatchObject({
    title: 'Não foi possível concluir. Tente novamente.',
    requestId: 'synthetic-request-id',
  });
  expect(JSON.stringify(response.json.mock.calls)).not.toContain('private');
});
