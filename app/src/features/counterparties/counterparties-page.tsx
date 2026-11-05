import { UsersRound as EmptyStateIcon } from 'lucide-react';
import { Select } from '../../shared/ui/controls/select';
import { useNotifications } from '../../shared/feedback/notification-provider';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../shared/ui/page-header';
import './counterparties.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, Category, Counterparty } from '../../shared/api/resources';
import { jsonBody, request } from '../../shared/api/client';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { CounterpartyPanel } from './components/counterparty-panel';
export function CounterpartiesPage() {
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [ruleFilter, setRuleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { success: setNotice, error: notifyError } = useNotifications();
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
  async function save(
    path: string,
    method: string,
    body?: unknown,
    version?: number,
    onSaved?: () => void,
  ) {
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
      onSaved?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível salvar.';
      if (creating) setError(message);
      else notifyError(message);
    } finally {
      setBusy(false);
    }
  }
  if (agents.isPending) return <Loading />;
  if (agents.isError) return <ErrorState error={agents.error} />;
  const filtered = agents.data.filter((a) => {
    const automated = a.enabled && a.rules.some((r) => r.enabled);
    return (
      (ruleFilter === 'all' || (ruleFilter === 'automated' ? automated : !automated)) &&
      [a.name, ...a.identifiers.map((i) => i.value)].some((value) =>
        value.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
      )
    );
  });
  return (
    <div className="counterparties-page">
      <PageHeader
        title={<>Pessoas e estabelecimentos</>}
        description="Reconheça quem recebe ou envia dinheiro e automatize a organização."
      ></PageHeader>

      <div className="directory-toolbar">
        <Button
          onClick={() => {
            setError('');
            setCreating(true);
          }}
          disabled={!navigator.onLine}
        >
          <Plus size={17} />
          Novo cadastro
        </Button>
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar pessoa, estabelecimento ou descrição"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição…"
          />
        </label>
        <label className="compact-filter">
          <span className="sr-only">Filtrar automação</span>
          <Select
            aria-label="Filtrar automação"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
          >
            <option value="all">Todos os cadastros</option>
            <option value="automated">Com automação</option>
            <option value="manual">Sem automação</option>
          </Select>
        </label>
        <span className="result-count">{filtered.length} cadastros</span>
      </div>
      {error && !creating && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!filtered.length && (
        <EmptyState
          icon={<EmptyStateIcon size={28} strokeWidth={1.5} />}
          title={
            agents.data.length
              ? 'Nenhum cadastro neste filtro'
              : 'Quem faz parte das suas finanças?'
          }
        >
          {agents.data.length
            ? 'Experimente outro nome ou filtro de automação.'
            : 'Crie uma pessoa ou estabelecimento. Ao relacionar suas descrições e categorias, os próximos lançamentos ficam mais fáceis de organizar.'}
        </EmptyState>
      )}
      <Modal
        open={creating}
        onOpenChange={(open) => !busy && setCreating(open)}
        title="Nova pessoa ou estabelecimento"
        description="Use um nome que você reconheça. As regras podem ser definidas depois."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save('/counterparties', 'POST', { name: newName }, undefined, () => {
              setCreating(false);
              setNewName('');
            });
          }}
        >
          <label>
            Nome
            <input
              required
              maxLength={150}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Pessoa ou estabelecimento"
            />
          </label>
          <div className="form-actions">
            <Button disabled={busy || !newName.trim() || !navigator.onLine}>Cadastrar</Button>
          </div>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Modal>
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
