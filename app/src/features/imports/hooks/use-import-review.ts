import { useState } from 'react';
import { jsonBody, request } from '../../../shared/api/client';
import type { ImportBatch, ImportItem } from '../../../shared/api/resources';
export function useImportReview(batch: ImportBatch, refresh: () => Promise<unknown>) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const selected = batch.items.filter((i) => i.selected);
  const unresolved = selected.filter((i) => i.transactionType === 'unclassified').length;
  async function review(
    item: ImportItem,
    change: Partial<Pick<ImportItem, 'selected' | 'transactionType'>>,
  ) {
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'If-Match': String(batch.version) },
        body: jsonBody({
          selected: item.selected,
          transactionType: item.transactionType,
          categoryId: item.categoryId,
          ...change,
        }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível revisar.');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      !window.confirm(
        `Adicionar ${selected.length} movimentos à conta? Revise transferências entre suas próprias contas antes de continuar.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/confirmations`, {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: jsonBody({ version: batch.version }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar.');
    } finally {
      setBusy(false);
    }
  }
  async function classify() {
    if (
      !window.confirm(
        'Classificar movimentos ainda não revisados: valores positivos como receitas e negativos como despesas? Confira depois as transferências entre suas contas.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/classifications`, {
        method: 'POST',
        body: jsonBody({ version: batch.version }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na classificação.');
    } finally {
      setBusy(false);
    }
  }
  async function reverse() {
    if (
      !window.confirm(
        'Desfazer os movimentos desta importação? Lançamentos editados precisam ser resolvidos primeiro.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/reversals`, {
        method: 'POST',
        headers: { 'If-Match': String(batch.version) },
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desfazer.');
    } finally {
      setBusy(false);
    }
  }
  return { page, setPage, busy, error, selected, unresolved, review, confirm, classify, reverse };
}
