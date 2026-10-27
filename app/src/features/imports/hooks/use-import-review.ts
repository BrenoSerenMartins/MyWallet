import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/auth-provider';
import type { Category } from '../../../shared/api/resources';
import { useState } from 'react';
import { ApiError, jsonBody, request } from '../../../shared/api/client';
import type { ImportBatch, ImportItem } from '../../../shared/api/resources';
export function useImportReview(batch: ImportBatch, refresh: () => Promise<unknown>) {
  const { session } = useAuth();
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: [session?.user.id, 'categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmationSucceeded, setConfirmationSucceeded] = useState(false);
  const status = confirmationSucceeded && batch.status === 'draft' ? 'confirmed' : batch.status;
  const awaitingConfirmationRefresh = confirmationSucceeded && batch.status === 'draft';
  const [key] = useState(() => crypto.randomUUID());
  const selected = batch.items.filter((i) => i.selected);
  const unresolved = selected.filter(
    (i) =>
      (i.transactionType === 'unclassified' && i.action !== 'reconcile') || i.action === 'review',
  ).length;
  async function review(
    item: ImportItem,
    change: Partial<
      Pick<
        ImportItem,
        | 'counterpartyId'
        | 'counterpartyName'
        | 'rememberCategory'
        | 'rememberCounterparty'
        | 'selected'
        | 'transactionType'
        | 'categoryId'
        | 'linkedTransactionId'
        | 'confirmNew'
        | 'refundOfId'
      >
    >,
  ) {
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'If-Match': String(batch.version) },
        body: jsonBody({
          counterpartyId: item.counterpartyId,
          counterpartyName: item.counterpartyName,
          rememberCategory: item.rememberCategory,
          rememberCounterparty: item.rememberCounterparty,
          selected: item.selected,
          transactionType: item.transactionType,
          categoryId: item.categoryId,
          linkedTransactionId: item.linkedTransactionId,
          confirmNew: item.confirmNew,
          refundOfId: item.refundOfId,
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
    if (busy || status !== 'draft') return;
    if (
      !window.confirm(
        selected.length
          ? `Adicionar ${selected.length} movimentos à conta? As duplicatas identificadas serão excluídas automaticamente. Confira transferências entre suas contas.`
          : 'Concluir esta revisão sem criar lançamentos? As duplicatas identificadas já estão registradas.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      try {
        await request(`/imports/${batch.id}/confirmations`, {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: jsonBody({ version: batch.version }),
        });
      } catch (failure) {
        // A lost response does not tell us whether the server committed. Read the
        // batch before offering another confirmation; never send a second POST here.
        if (failure instanceof ApiError && failure.status > 0 && failure.status < 500)
          throw failure;
        let current: ImportBatch;
        try {
          current = await request<ImportBatch>(`/imports/${batch.id}`);
        } catch {
          throw new Error(
            'Não foi possível verificar se a confirmação terminou. Atualize o relatório para conferir o status antes de tentar novamente.',
          );
        }
        if (current.status !== 'confirmed') throw failure;
        client.setQueryData([session?.user.id, 'import', batch.id], current);
      }
      setConfirmationSucceeded(true);
      // Confirmation has already committed. A refresh failure must not turn it
      // into a failed financial operation or re-enable the confirmation button.
      await refresh().catch(() => {});
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
      setConfirmationSucceeded(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desfazer.');
    } finally {
      setBusy(false);
    }
  }
  async function changeHistoryMode(path: 'history' | 'reviews', message: string) {
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/${path}`, {
        method: 'POST',
        body: jsonBody({ version: batch.version }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o modo do extrato.');
    } finally {
      setBusy(false);
    }
  }
  const retainHistory = () =>
    changeHistoryMode(
      'history',
      'Salvar este extrato para consulta, sem criar lançamentos ou alterar saldos? Todos os movimentos do arquivo serão mantidos, inclusive os desmarcados.',
    );
  const reopenHistory = () =>
    changeHistoryMode(
      'reviews',
      'Voltar à revisão para integrar este extrato? Nenhum movimento será lançado até a confirmação. A revisão para integrar expira em 24 horas, mas o histórico será preservado; você pode salvá-lo novamente para consulta.',
    );
  return {
    categories,
    page,
    setPage,
    busy,
    error,
    status,
    awaitingConfirmationRefresh,
    selected,
    unresolved,
    review,
    confirm,
    classify,
    reverse,
    retainHistory,
    reopenHistory,
  };
}
