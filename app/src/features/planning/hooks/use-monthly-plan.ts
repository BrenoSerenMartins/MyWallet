import { shiftMonth } from '../../../shared/formatting/month';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request, jsonBody } from '../../../shared/api/client';
import type { MonthlyPlan } from '../../../shared/api/resources';
import type { components } from '../../../shared/api/generated';
export function useMonthlyPlan(month: string, scope = 'all') {
  const client = useQueryClient();
  const key = scope === 'all' ? ['planning', month] : ['planning', month, scope];
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      request<MonthlyPlan>(`/planning/${month}${scope === 'all' ? '' : `?scope=${scope}`}`),
  });
  async function save(input: components['schemas']['SaveMonthlyPlanDto']) {
    const plan = await request<MonthlyPlan>(`/planning/${month}`, {
      method: 'PUT',
      body: jsonBody(input),
    });
    if (scope === 'all') client.setQueryData(key, plan);
    else await query.refetch();
  }
  async function copy(version: number, sourceVersion: number) {
    const plan = await request<MonthlyPlan>(`/planning/${month}/copies`, {
      method: 'POST',
      body: jsonBody({ version, sourceVersion }),
    });
    if (scope === 'all') client.setQueryData(key, plan);
    else await query.refetch();
  }
  return { query, save, copy };
}

/** An unsaved monthly response has version zero; its calculated totals are not a saved plan. */
export function usePreviousMonthlyPlan(month: string) {
  const previous = month === '1900-01' ? month : shiftMonth(month, -1);
  const query = useQuery({
    queryKey: ['planning', previous],
    queryFn: () => request<MonthlyPlan>(`/planning/${previous}`),
    enabled: month !== '1900-01',
  });
  return {
    previous,
    query,
    available: month !== '1900-01' && query.isSuccess && query.data.version > 0,
  };
}
