import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request, jsonBody } from '../../../shared/api/client';
import type { MonthlyPlan } from '../../../shared/api/resources';
import type { components } from '../../../shared/api/generated';
export function useMonthlyPlan(month: string) {
  const client = useQueryClient();
  const key = ['planning', month];
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<MonthlyPlan>(`/planning/${month}`),
  });
  async function save(input: components['schemas']['SaveMonthlyPlanDto']) {
    const plan = await request<MonthlyPlan>(`/planning/${month}`, {
      method: 'PUT',
      body: jsonBody(input),
    });
    client.setQueryData(key, plan);
  }
  async function copy(version: number, sourceVersion: number) {
    const plan = await request<MonthlyPlan>(`/planning/${month}/copies`, {
      method: 'POST',
      body: jsonBody({ version, sourceVersion }),
    });
    client.setQueryData(key, plan);
  }
  return { query, save, copy };
}
