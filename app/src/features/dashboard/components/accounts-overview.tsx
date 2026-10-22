import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Landmark, Plus } from 'lucide-react';
import type { Account } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function AccountsOverview({ accounts, visible }: { accounts: Account[]; visible: boolean }) {
  return (
    <section className="panel account-overview">
      <div className="section-heading">
        <div>
          <h2>Minhas contas</h2>
          <p>Cada parte do seu dinheiro.</p>
        </div>
        <Link to="/accounts" aria-label="Ver contas">
          <ArrowUpRight size={18} />
        </Link>
      </div>
      {accounts.length ? (
        accounts.map((a) => (
          <Link className="account-line" to={`/accounts/${a.id}`} key={a.id}>
            <span className={`bank-icon ${a.institution === 'mercado_pago' ? 'mp' : ''}`}>
              {a.institution === 'mercado_pago' ? 'mp' : <Landmark size={19} />}
            </span>
            <div>
              <strong>{a.name}</strong>
              <span>{a.institution === 'mercado_pago' ? 'Mercado Pago' : a.institution}</span>
            </div>
            <strong>{visible ? money(a.balance) : '••••••'}</strong>
            <ChevronRight size={15} />
          </Link>
        ))
      ) : (
        <div className="small-empty">
          <Landmark size={28} />
          <p>Adicione sua primeira conta para começar.</p>
          <Link className="text-button" to="/accounts">
            Adicionar conta <Plus size={15} />
          </Link>
        </div>
      )}
      <div className="coverage-note">
        <span className="status-dot" />
        <p>
          Este saldo considera apenas as contas cadastradas. Investimentos e outros bens chegarão em
          uma próxima etapa.
        </p>
      </div>
    </section>
  );
}
