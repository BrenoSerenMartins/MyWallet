import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CategoryGroup } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { Button, ErrorState, Loading, Modal } from '../../../shared/ui/primitives';
import type { components } from '../../../shared/api/generated';
type DeletionPreview = components['schemas']['CategoryGroupDeletionResourceDto'];
export function DeleteGroupDialog({
  group,
  onClose,
  onDelete,
}: {
  group: CategoryGroup;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = useQuery({
    queryKey: ['category-group-deletion', group.id],
    queryFn: () => request<DeletionPreview>(`/category-groups/${group.id}/deletion-preview`),
  });
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o grupo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={`Excluir grupo ${group.name}?`}
      description="Confira o destino das categorias antes de continuar."
    >
      {preview.isPending ? (
        <Loading />
      ) : preview.isError ? (
        <ErrorState error={preview.error} />
      ) : (
        <div className="form-stack">
          <p>
            {preview.data.categoryCount === 0 ? (
              'Este grupo não tem categorias.'
            ) : (
              <>
                <strong>
                  {preview.data.categoryCount}{' '}
                  {preview.data.categoryCount === 1
                    ? 'categoria será movida'
                    : 'categorias serão movidas'}
                </strong>{' '}
                para <strong>{preview.data.destinationGroupName}</strong>, o grupo padrão de{' '}
                {group.type === 'expense' ? 'despesas' : 'receitas'}.
              </>
            )}
          </p>
          <p className="field-help">
            As categorias, seus lançamentos e o planejamento serão preservados. Apenas o grupo será
            excluído.
          </p>
          {!!preview.data.conflictingNames.length && (
            <p role="alert" className="form-error">
              Já existem categorias com estes nomes no destino:{' '}
              {preview.data.conflictingNames.join(', ')}. Renomeie ou mova essas categorias antes de
              excluir.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="delete-group-actions">
            <Button className="secondary" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={busy || !!preview.data.conflictingNames.length || !navigator.onLine}
              onClick={() => void confirm()}
            >
              {busy ? 'Excluindo…' : 'Excluir grupo'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
