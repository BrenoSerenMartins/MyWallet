import './counterparties.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, Category, Counterparty } from '../../shared/api/resources';
import { jsonBody, request } from '../../shared/api/client';
import { Button, ErrorState, Loading } from '../../shared/ui/primitives';
import { CounterpartyPanel } from './components/counterparty-panel';
export function CounterpartiesPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const agents = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => request<Counterparty[]>('/counterparties'),
  });
  const accounts = useQuery({
    queryKey: ['counterparty-accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const categories = useQuery({
    queryKey: ['counterparty-categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  async function save(path: string, method: string, body?: unknown, version?: number) {
    setBusy(true);
    setError('');
    try {
      const result = await request<{ updated?: number; linked?: number; categorized?: number }>(
        path,
        {
          method,
          headers: version ? { 'If-Match': String(version) } : undefined,
          body: body ? jsonBody(body) : undefined,
        },
      );
      if (result.linked !== undefined)
        setNotice(
          `${result.linked} lançamentos vinculados; ${result.categorized ?? 0} categorias atualizadas pelas regras existentes. Valores e escolhas manuais preservados.`,
        );
      else if (result.updated !== undefined)
        setNotice(
          `${result.updated} lançamentos atualizados. Escolhas manuais e valores foram preservados.`,
        );
      else setNotice('Relação salva.');
      await client.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  if (agents.isPending) return <Loading />;
  if (agents.isError) return <ErrorState error={agents.error} />;
  const filtered = agents.data.filter((a) =>
    [a.name, ...a.identifiers.map((i) => i.value)].some((value) =>
      value.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ),
  );
  return (
    <div className="counterparties-page">
      <header className="page-heading">
        <div>
          <h1>Pessoas e estabelecimentos</h1>
          <p>Pessoas, estabelecimentos e as relações que simplificam seus próximos lançamentos.</p>
        </div>
      </header>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void save('/counterparties', 'POST', { name: newName });
        }}
      >
        <label>
          Novo cadastro
          <input
            required
            maxLength={150}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pessoa ou estabelecimento"
          />
        </label>
        <div className="form-actions">
          <Button disabled={busy || !newName.trim()}>Cadastrar</Button>
        </div>
      </form>
      {notice && (
        <p className="review-banner" role="status">
          {notice}
        </p>
      )}
      <label>
        Buscar pessoa, estabelecimento ou descrição
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome da pessoa ou estabelecimento"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!filtered.length && (
        <div className="panel">
          <h2>Nenhuma pessoa ou estabelecimento encontrado</h2>
          <p>
            Abra um lançamento, escolha a pessoa ou estabelecimento e marque a opção de reconhecer a
            descrição. A regra será aplicada aos próximos movimentos reconhecidos.
          </p>
        </div>
      )}
      {filtered.map((agent) => (
        <CounterpartyPanel
          key={`${agent.id}-${agent.version}`}
          agent={agent}
          accounts={accounts.data ?? []}
          categories={categories.data ?? []}
          busy={busy}
          rename={(name) =>
            void save(
              `/counterparties/${agent.id}`,
              'PATCH',
              { name, enabled: agent.enabled },
              agent.version,
            )
          }
          toggle={() =>
            void save(
              `/counterparties/${agent.id}`,
              'PATCH',
              { name: agent.name, enabled: !agent.enabled },
              agent.version,
            )
          }
          relate={(value) => save(`/counterparties/${agent.id}/relations`, 'POST', value)}
          link={(value) => save(`/counterparties/${agent.id}/identifiers`, 'POST', value)}
          toggleRule={(id, enabled, version, categoryId) =>
            void save(`/counterparties/rules/${id}`, 'PATCH', { enabled, categoryId }, version)
          }
          removeIdentifier={(id) => {
            if (
              window.confirm(
                'Remover esta identificação? Os lançamentos existentes serão preservados.',
              )
            )
              void save(`/counterparties/${agent.id}/identifiers/${id}`, 'DELETE');
          }}
        />
      ))}
    </div>
  );
}
