import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Plus, Upload } from 'lucide-react';
const actions = [
  {
    to: '/transactions?new=1',
    Icon: Plus,
    title: 'Novo lançamento',
    caption: 'Registre uma entrada ou saída',
  },
  {
    to: '/imports',
    Icon: Upload,
    title: 'Importar extrato',
    caption: 'PDF, CSV e XLSX do Mercado Pago',
  },
  {
    to: '/planning',
    Icon: CalendarDays,
    title: 'Planejar meu mês',
    caption: 'Previsto e realizado, lado a lado',
  },
];
export function QuickActions() {
  return (
    <section className="quick-actions" aria-label="Atalhos">
      {actions.map(({ to, Icon, title, caption }) => (
        <Link to={to} key={to}>
          <span className="quick-icon">
            <Icon size={22} />
          </span>
          <div>
            <strong>{title}</strong>
            <span>{caption}</span>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      ))}
    </section>
  );
}
