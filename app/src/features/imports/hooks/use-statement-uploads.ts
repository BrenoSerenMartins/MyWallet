import { useEffect, useRef, useState } from 'react';
import { request } from '../../../shared/api/client';
import { getRequestWorkspace } from '../../../shared/api/workspace-selection';
import type { ImportBatch } from '../../../shared/api/resources';
export interface StatementUpload {
  name: string;
  status: 'queued' | 'reading' | 'ready' | 'error' | 'skipped';
  result?: ImportBatch;
  repeated?: boolean;
  error?: string;
}
export function useStatementUploads(onComplete: (rows: StatementUpload[]) => void) {
  const [rows, setRows] = useState<StatementUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const running = useRef(false);
  const stopped = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopped.current = true;
    };
  }, []);
  function stop() {
    stopped.current = true;
    setStopping(true);
  }
  async function upload(files: File[], accountId: string) {
    if (running.current || !files.length || !accountId) return;
    const workspace = getRequestWorkspace();
    const current: StatementUpload[] = files.map((file) => ({ name: file.name, status: 'queued' }));
    const seen = new Set<string>();
    running.current = true;
    stopped.current = false;
    setStopping(false);
    setBusy(true);
    setRows([...current]);
    const active = () => mounted.current && getRequestWorkspace() === workspace;
    for (let index = 0; index < files.length; index++) {
      if (stopped.current || !active()) break;
      current[index] = { name: files[index].name, status: 'reading' };
      setRows([...current]);
      try {
        if (files[index].size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
        const form = new FormData();
        form.set('accountId', accountId);
        form.set('file', files[index]);
        const result = await request<ImportBatch>('/imports', { method: 'POST', body: form });
        current[index] = {
          name: files[index].name,
          status: 'ready',
          result,
          repeated: seen.has(result.id),
        };
        seen.add(result.id);
      } catch (error) {
        current[index] = {
          name: files[index].name,
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Não foi possível processar este arquivo.',
        };
      }
      if (active()) setRows([...current]);
    }
    for (const row of current) if (row.status === 'queued') row.status = 'skipped';
    running.current = false;
    if (active()) {
      setRows([...current]);
      setBusy(false);
      setStopping(false);
      onComplete(current);
    }
  }
  return { rows, busy, stopping, upload, stop };
}
