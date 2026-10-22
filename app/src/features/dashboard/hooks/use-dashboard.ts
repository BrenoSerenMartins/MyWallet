import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/auth-provider';
import { request } from '../../../shared/api/client';
import type { Collection, Dashboard, Transaction } from '../../../shared/api/resources';
export function useDashboard(month: string) {
  const { session } = useAuth();
  const [year, value] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10);
  const summary = useQuery({
    queryKey: [session?.user.id, 'dashboard', month],
    queryFn: () => request<Dashboard>(`/dashboard?from=${from}&to=${to}`),
  });
  const movements = useQuery({
    queryKey: [session?.user.id, 'recent', month],
    queryFn: () => request<Collection<Transaction>>(`/transactions?limit=5&from=${from}&to=${to}`),
  });
  return { summary, movements };
}
