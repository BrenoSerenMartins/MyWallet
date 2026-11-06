import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, CalendarDays, CreditCard, Wallet } from 'lucide-react';
import { Logo, ThemeSwitcher } from '../../shared/ui/primitives';
import { productName } from '../../shared/brand';
import './public-entry.css';
import './landing.css';

export function LandingPage() {
  return (
    <div className="landing-page public-entry">
      <header className="landing-header">
        <Link to="/" aria-label={`${productName} — início`}>
          <Logo />
        </Link>
        <Link className="button secondary" to="/painel">
          Acessar painel <ArrowRight size={16} />
        </Link>
      </header>
      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-copy">
            <h1>
              O seu mês.
              <br />
              Os seus planos.
              <br />
              <em>Tudo conectado.</em>
            </h1>
            <p>
              Contas, cartões e planejamento no mesmo lugar. Entenda o que aconteceu com seu
              dinheiro e organize o que vem pela frente.
            </p>
            <Link className="button" to="/painel">
              Começar meu planejamento <ArrowRight size={18} />
            </Link>
            <span className="landing-caption">Já tem uma conta? Entre pelo painel.</span>
          </div>
          <div
            className="landing-preview public-surface"
            aria-label="Exemplo ilustrativo do painel, com valores fictícios"
          >
            <div className="landing-preview-top">
              <span>
                <Wallet size={17} /> Visão geral
              </span>
              <span>Seu mês</span>
            </div>
            <div className="landing-preview-title">
              <strong>Um olhar para o seu dinheiro</strong>
              <small>Exemplo ilustrativo · valores fictícios</small>
            </div>
            <div className="landing-metrics">
              <div>
                <span>Receitas</span>
                <strong>R$ 4.200,00</strong>
              </div>
              <div>
                <span>Despesas</span>
                <strong>R$ 2.850,00</strong>
              </div>
              <div>
                <span>Resultado do mês</span>
                <strong>R$ 1.350,00</strong>
              </div>
            </div>
            <div className="landing-preview-plan">
              <span>Seu planejamento</span>
              <strong>Saiba para onde vai cada parte.</strong>
              <div className="landing-plan-bar" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="landing-plan-legend">
                <span>Essenciais</span>
                <span>Seus planos</span>
                <span>Reserva</span>
              </div>
            </div>
            <div className="landing-preview-row">
              <CreditCard size={18} />
              <span>
                Cartões e faturas<small>Compras, parcelas e pagamentos conectados.</small>
              </span>
              <ArrowRight size={16} />
            </div>
          </div>
        </section>
        <section className="landing-features" aria-label="O que você pode organizar">
          <article>
            <ArrowLeftRight size={23} />
            <h2>Cada movimento no seu lugar.</h2>
            <p>Acompanhe suas contas e consulte os lançamentos com clareza.</p>
          </article>
          <article>
            <CalendarDays size={23} />
            <h2>Um plano para o mês.</h2>
            <p>Compare o previsto com o realizado e acompanhe os próximos vencimentos.</p>
          </article>
          <article>
            <CreditCard size={23} />
            <h2>Cartões junto das contas.</h2>
            <p>Veja suas faturas e vincule os pagamentos que já estão no extrato.</p>
          </article>
        </section>
      </main>
      <footer className="landing-footer">
        <span>{productName} · Um mês de cada vez.</span>
        <ThemeSwitcher />
      </footer>
    </div>
  );
}
