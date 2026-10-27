import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../../../shared/api/client';
import type { Counterparty } from '../../../shared/api/resources';
export function CounterpartyFields({
  agent,
  name,
  remember,
  category,
  automatic,
  onAgent,
  onName,
  onRemember,
  children,
}: {
  agent: string;
  name: string;
  remember: boolean;
  category: string;
  automatic: boolean;
  children?: ReactNode;
  onAgent: (value: string) => void;
  onName: (value: string) => void;
  onRemember: (value: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => request<Counterparty[]>('/counterparties'),
  });
  return (
    <details className="secondary-disclosure" open={!!agent || automatic || undefined}>
      <summary>Pessoa ou estabelecimento {automatic ? '· categoria automática' : ''}</summary>
      <div className="form-stack">
        <label>
          Agente
          <select
            value={agent}
            onChange={(e) => onAgent(e.target.value)}
            disabled={query.isPending || query.isError}
          >
            <option value="">Reconhecer automaticamente quando possível</option>
            {(query.data ?? [])
              .filter((a) => a.enabled || a.id === agent)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.enabled ? '' : ' (desativado)'}
                </option>
              ))}
            <option value="new">Criar pessoa ou estabelecimento</option>
          </select>
        </label>
        {agent === 'new' && (
          <label>
            Nome do agente
            <input
              required
              maxLength={150}
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Supermercado ABC"
            />
          </label>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={remember}
            disabled={!category || !agent}
            onChange={(e) => onRemember(e.target.checked)}
          />
          Usar esta categoria neste agente, incluindo o histórico reconhecido desta conta
        </label>
        <p className="field-help">
          A regra usa o mesmo tipo de movimento e uma descrição específica ou um ID de loja
          informado pela origem. Preenche o histórico sem categoria ou classificado por regra,
          preservando escolhas manuais. <Link to="/counterparties">Gerenciar agentes e regras</Link>
        </p>
        {children}
        {query.isError && (
          <p className="form-error">
            Não foi possível carregar os agentes. Você pode salvar o lançamento sem criar uma regra.
          </p>
        )}
      </div>
    </details>
  );
}
