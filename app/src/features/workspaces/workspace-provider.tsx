import './workspaces.css';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-provider';
import { request, jsonBody } from '../../shared/api/client';
import { setRequestWorkspace } from '../../shared/api/workspace-selection';
import type { Workspace } from '../../shared/api/resources';
interface WorkspaceContextValue {
  workspaces: Workspace[];
  active: Workspace | null;
  loading: boolean;
  error: unknown;
  select: (id: string | null) => void;
  reload: () => void;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  create: (input: { name: string; description: string; color: string }) => Promise<Workspace>;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const key = ['workspaces', session!.user.id];
  const storageKey = `mywallet-workspace:${session!.user.id}`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const query = useQuery({ queryKey: key, queryFn: () => request<Workspace[]>('/workspaces') });
  const select = (id: string | null) => {
    setRequestWorkspace(id);
    setSelectedId(id);
    try {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    } catch {}
  };
  useEffect(() => {
    if (!query.data) return;
    if (!restored) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch {}
      select(
        query.data.some((w) => w.id === saved)
          ? saved
          : query.data.length === 1
            ? query.data[0].id
            : null,
      );
      setRestored(true);
    } else if (selectedId && !query.data.some((w) => w.id === selectedId)) select(null);
  }, [query.data, restored, selectedId, storageKey]);
  useEffect(() => () => setRequestWorkspace(null), []);
  async function create(input: { name: string; description: string; color: string }) {
    const workspace = await request<Workspace>('/workspaces', {
      method: 'POST',
      body: jsonBody(input),
    });
    client.setQueryData<Workspace[]>(key, (previous) => [...(previous ?? []), workspace]);
    select(workspace.id);
    return workspace;
  }
  async function archive(id: string) {
    await request(`/workspaces/${id}`, { method: 'DELETE' });
    if (selectedId === id) select(null);
    client.setQueryData<Workspace[]>(key, (previous) =>
      previous?.filter((workspace) => workspace.id !== id),
    );
    await Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: ['workspace-trash', session!.user.id] }),
    ]);
  }
  async function restore(id: string) {
    await request(`/workspaces/${id}/restorations`, { method: 'POST' });
    await Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: ['workspace-trash', session!.user.id] }),
    ]);
  }
  return (
    <WorkspaceContext.Provider
      value={{
        workspaces: query.data ?? [],
        active: query.data?.find((w) => w.id === selectedId) ?? null,
        loading: query.isPending || (!restored && !query.isError),
        error: query.error,
        select,
        create,
        archive,
        restore,
        reload: () => void query.refetch(),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is required.');
  return value;
}
