import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/auth-provider';
import { request } from '../../../shared/api/client';
import type { DashboardHistory } from '../../../shared/api/resources';
export function useDashboardHistory(month: string, months: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [session?.user.id, 'dashboard-history', month, months],
    queryFn: () => request<DashboardHistory>(`/dashboard/history?month=${month}&months=${months}`),
  });
}
