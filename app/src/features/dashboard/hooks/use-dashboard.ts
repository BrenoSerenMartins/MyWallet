import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/auth-provider';
import { request } from '../../../shared/api/client';
import { dateToday } from '../../../shared/formatting/money';
import type {
  Collection,
  Dashboard,
  MonthlyPlan,
  Transaction,
} from '../../../shared/api/resources';
export function monthRange(month: string) {
  const [year, value] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
  return { from, to, lastDay };
}
export function useDashboard(month: string) {
  const { session } = useAuth();
  const { from, to, lastDay } = monthRange(month);
  const currentMonth = dateToday().slice(0, 7);
  const summaryOptions = (period: string) => {
    const range = monthRange(period);
    return {
      queryKey: [session?.user.id, 'dashboard', period],
      queryFn: () => request<Dashboard>(`/dashboard?from=${range.from}&to=${range.to}`),
    };
  };
  // Shares the request in the current month. Changing the analysis period never
  // replaces current balances with a loading screen or a historical balance.
  const snapshot = useQuery(summaryOptions(currentMonth));
  const summary = useQuery(summaryOptions(month));
  const movements = useQuery({
    queryKey: [session?.user.id, 'recent', month],
    queryFn: () => request<Collection<Transaction>>(`/transactions?limit=5&from=${from}&to=${to}`),
  });
  const plan = useQuery({
    queryKey: ['planning', month],
    queryFn: () => request<MonthlyPlan>(`/planning/${month}`),
  });
  const transactionsLink = (type?: string) =>
    `/transactions?${new URLSearchParams({ from, to: lastDay, ...(type ? { type } : {}) })}`;
  return { snapshot, summary, movements, plan, transactionsLink };
}
