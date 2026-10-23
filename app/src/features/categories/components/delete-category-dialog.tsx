import { useState } from 'react';
import type { Category } from '../../../shared/api/resources';
import { Button, Modal } from '../../../shared/ui/primitives';
export function DeleteCategoryDialog({
  category,
  onClose,
  onDelete,
}: {
  category: Category;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={`Excluir categoria ${category.name}?`}
      description="Os registros financeiros existentes serão preservados."
    >
      <div className="form-stack">
        <p>
          A categoria sairá desta lista e das opções para novos lançamentos. Movimentações e
          planejamentos anteriores continuam com a categoria no histórico.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="delete-group-actions">
          <Button className="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !navigator.onLine} onClick={() => void confirm()}>
            {busy ? 'Excluindo…' : 'Excluir categoria'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
