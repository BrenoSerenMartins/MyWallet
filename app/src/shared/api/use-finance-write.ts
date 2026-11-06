import { getRequestWorkspaceRole } from './workspace-selection';
import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, jsonBody, request } from './client';
export function useFinanceWrite() {
  const client = useQueryClient();
  const receipts = useRef(new Map<string, string>());
  return async function write<T = unknown>(
    path: string,
    body?: unknown,
    version?: number,
    method = 'POST',
  ): Promise<T> {
    if (getRequestWorkspaceRole() === 'reader' && !path.startsWith('/alerts'))
      throw new ApiError('Seu acesso permite apenas consultar este espaço.', 403);
    const signature = JSON.stringify({ path, body, version, method });
    const key = receipts.current.get(signature) ?? crypto.randomUUID();
    receipts.current.set(signature, key);
    try {
      const result = await request<T>(path, {
        method,
        headers: {
          'Idempotency-Key': key,
          ...(version !== undefined ? { 'If-Match': String(version) } : {}),
        },
        ...(body !== undefined ? { body: jsonBody(body) } : {}),
      });
      receipts.current.delete(signature);
      void client.invalidateQueries();
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) void client.invalidateQueries();
      throw error;
    }
  };
}
