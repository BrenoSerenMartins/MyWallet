import { NavLink } from 'react-router-dom';

/** Accounts hold money; card bills hold debt. Keep the two destinations adjacent. */
export function FinanceAreaNav() {
  return (
    <nav className="area-navigation" aria-label="Contas e cartões">
      <NavLink to="/accounts">Contas e saldos</NavLink>
      <NavLink to="/cards">Cartões e faturas</NavLink>
    </nav>
  );
}
