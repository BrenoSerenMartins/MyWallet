import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, request, jsonBody } from '../../../shared/api/client';
import type { CommitmentsSummary } from '../../../shared/api/resources';
export function useCommitments(month: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['commitments', month],
    queryFn: () => request<CommitmentsSummary>(`/commitments?month=${month}`),
  });
  async function changed() {
    await Promise.all(
      ['commitments', 'planning', 'accounts', 'transactions', 'recent', 'dashboard'].map((key) =>
        client.invalidateQueries({ predicate: (q) => q.queryKey.includes(key) }),
      ),
    );
  }
  async function write(
    path: string,
    body: unknown,
    version?: number,
    method = 'POST',
    key?: string,
  ) {
    try {
      const result = await request(`/commitments${path}`, {
        method,
        headers: {
          ...(version !== undefined ? { 'If-Match': String(version) } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body !== undefined ? { body: jsonBody(body) } : {}),
      });
      void changed();
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) void changed();
      throw error;
    }
  }
  return { query, write };
}
