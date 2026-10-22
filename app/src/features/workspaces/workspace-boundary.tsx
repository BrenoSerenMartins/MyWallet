import { useMemo, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWorkspace } from './workspace-provider';
import { ErrorState, Loading } from '../../shared/ui/primitives';
export function WorkspaceBoundary() {
  const { active, loading, error, reload } = useWorkspace();
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30000 }, mutations: { retry: false } },
      }),
    [active?.id],
  );
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  if (loading)
    return (
      <div className="startup">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="startup">
        <ErrorState error={error} retry={reload} />
      </div>
    );
  if (!active) return <Navigate to="/workspaces" replace />;
  return (
    <QueryClientProvider key={active.id} client={client}>
      <Outlet key={active.id} />
    </QueryClientProvider>
  );
}
