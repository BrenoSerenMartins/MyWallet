import { useEffect, useRef, useState } from 'react';
import { request } from '../../../shared/api/client';
import { getRequestWorkspace } from '../../../shared/api/workspace-selection';
import type { Account, Category, Collection, Transaction } from '../../../shared/api/resources';
import { movementCsv } from '../movement-csv';
export function ExportMovements({
  query,
  accounts,
  categories,
  disabled,
}: {
  query: string;
  accounts: Account[];
  categories: Category[];
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const downloadLink = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const stop = () => controller.current?.abort();
    window.addEventListener('plannedwallet:workspace-changed', stop);
    return () => {
      stop();
      window.removeEventListener('plannedwallet:workspace-changed', stop);
    };
  }, []);
  async function download() {
    const workspace = getRequestWorkspace();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams(query);
      params.delete('cursor');
      params.set('limit', '100');
      const items: Transaction[] = [],
        seen = new Set<string>();
      let cursor: string | null = null;
      do {
        if (abort.signal.aborted || workspace !== getRequestWorkspace()) return;
        if (cursor) params.set('cursor', cursor);
        const page = await request<Collection<Transaction>>('/transactions?' + params, {
          signal: abort.signal,
        });
        if (abort.signal.aborted || workspace !== getRequestWorkspace()) return;
        items.push(...page.items);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new Error('A consulta mudou durante a exportação. Tente novamente.');
        if (cursor) seen.add(cursor);
      } while (cursor);
      const blob = new Blob(['\ufeff' + movementCsv(items, accounts, categories)], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = downloadLink.current;
      if (!anchor) {
        URL.revokeObjectURL(url);
        return;
      }
      // Keep the download inside the active dialog's DOM and focus boundary.
      anchor.href = url;
      anchor.click();
      anchor.removeAttribute('href');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : 'Não foi possível exportar.');
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div>
      <a ref={downloadLink} hidden download="plannedwallet-movimentacoes.csv" aria-hidden="true" />
      <button
        type="button"
        className="text-button"
        disabled={disabled || busy}
        onClick={() => void download()}
      >
        {busy ? 'Exportando…' : 'Exportar consulta CSV'}
      </button>
      <p className="field-help">
        Inclui todas as páginas dos filtros aplicados. O período segue a competência; a data
        original do extrato é preservada em outra coluna.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
