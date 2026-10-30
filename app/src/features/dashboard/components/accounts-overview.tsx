import { Link } from 'react-router-dom';
import { ChevronRight, Landmark, Plus } from 'lucide-react';
import type { Account } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function AccountsOverview({ accounts, visible }: { accounts: Account[]; visible: boolean }) {
  return (
    <div className="account-overview">
      {accounts.length ? (
        accounts.map((a) => (
          <Link className="account-line" to={`/accounts/${a.id}`} key={a.id}>
            <span className={`bank-icon ${a.institution === 'mercado_pago' ? 'mp' : ''}`}>
              {a.institution === 'mercado_pago' ? 'mp' : <Landmark size={19} />}
            </span>
            <div>
              <strong>{a.name}</strong>
              <span>
                {['benefit_food', 'benefit_meal'].includes(a.type)
                  ? 'Benefício · uso restrito'
                  : a.type === 'reserve'
                    ? 'Reserva'
                    : 'Disponível'}
              </span>
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
    </div>
  );
}
