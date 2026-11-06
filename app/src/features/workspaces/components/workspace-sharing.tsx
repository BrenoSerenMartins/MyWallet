import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Workspace } from '../../../shared/api/resources';
import { request, jsonBody } from '../../../shared/api/client';
import { FinanceForm } from '../../../shared/ui/finance-forms';
import { Select } from '../../../shared/ui/controls/select';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
type Member = { actorId: string; role: string; email?: string | null };
type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  revokedAt: string | null;
  acceptedAt: string | null;
};
export function WorkspaceSharing({ workspace }: { workspace: Workspace }) {
  const client = useQueryClient(),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('reader'),
    [link, setLink] = useState(''),
    [error, setError] = useState('');
  const members = useQuery({
      queryKey: ['members', workspace.id],
      queryFn: () => request<Member[]>(`/workspaces/${workspace.id}/members`),
    }),
    invites = useQuery({
      queryKey: ['invites', workspace.id],
      queryFn: () => request<Invite[]>(`/workspaces/${workspace.id}/invites`),
    });
  async function change(path: string, method: string, body?: unknown) {
    setError('');
    try {
      await request(`/workspaces/${workspace.id}/${path}`, {
        method,
        ...(body ? { body: jsonBody(body) } : {}),
      });
      await client.invalidateQueries({ queryKey: ['members', workspace.id] });
      await client.invalidateQueries({ queryKey: ['invites', workspace.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o acesso.');
    }
  }
  return (
    <div className="form-stack">
      <p>
        Editor pode alterar as finanças e exportar dados. Leitor pode apenas consultar. Somente você
        gerencia acessos e restaura backups.
      </p>
      <FinanceForm
        label="Criar link de convite"
        onSubmit={async () => {
          const r = await request<{ token: string }>(`/workspaces/${workspace.id}/invites`, {
            method: 'POST',
            body: jsonBody({ email, role }),
          });
          setLink(`${window.location.origin}/workspaces?invite=${r.token}`);
          await invites.refetch();
        }}
      >
        <label>
          E-mail de quem vai participar
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Permissão
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="reader">Leitor</option>
            <option value="editor">Editor</option>
          </Select>
        </label>
      </FinanceForm>
      {link && (
        <label>
          Envie este link para a pessoa (válido por 7 dias)
          <input value={link} readOnly onFocus={(e) => e.target.select()} />
          <Button className="secondary" onClick={() => void navigator.clipboard.writeText(link)}>
            Copiar convite
          </Button>
        </label>
      )}
      <h3>Participantes</h3>
      {members.isPending ? (
        <Loading />
      ) : members.isError ? (
        <ErrorState error={members.error} />
      ) : (
        members.data.map((m) => (
          <div className="form-stack" key={m.actorId}>
            <span>{m.role === 'owner' ? 'Você · proprietário' : (m.email ?? m.actorId)}</span>
            {m.role !== 'owner' && (
              <div className="inline-actions">
                <Select
                  aria-label={`Permissão de ${m.actorId}`}
                  value={m.role}
                  onChange={(e) =>
                    void change(`members/${m.actorId}`, 'PATCH', { role: e.target.value })
                  }
                >
                  <option value="reader">Leitor</option>
                  <option value="editor">Editor</option>
                </Select>
                <button
                  className="text-button"
                  onClick={() => void change(`members/${m.actorId}`, 'DELETE')}
                >
                  Remover acesso
                </button>
              </div>
            )}
          </div>
        ))
      )}
      <h3>Convites</h3>
      {invites.data?.map((i) => (
        <div key={i.id}>
          <p>
            {i.email} ·{' '}
            {i.acceptedAt
              ? 'Aceito'
              : i.revokedAt
                ? 'Revogado'
                : new Date(i.expiresAt) < new Date()
                  ? 'Expirado'
                  : 'Pendente'}
          </p>
          {!i.acceptedAt && !i.revokedAt && (
            <button
              className="text-button"
              onClick={() => void change(`invites/${i.id}`, 'DELETE')}
            >
              Revogar convite
            </button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
