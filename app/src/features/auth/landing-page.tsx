import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeftRight,
  CalendarDays,
  CreditCard,
  Wallet,
  Check,
  FileText,
  ChartNoAxesCombined,
  Layers,
} from 'lucide-react';
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
        <nav className="landing-navigation" aria-label="Navegação da apresentação">
          <a href="#recursos">Recursos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
        </nav>
        <Link className="button secondary" to="/painel">
          Acessar painel <ArrowRight size={16} />
        </Link>
      </header>
      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">PLANEJAMENTO FINANCEIRO E PATRIMÔNIO</span>
            <h1>
              O seu mês.
              <br />
              Os seus planos.
              <br />
              <em>Tudo conectado.</em>
            </h1>
            <p>
              Saiba o que pode gastar hoje e planeje o que quer conquistar amanhã. Suas contas,
              cartões e patrimônio se encontram em uma visão que faz sentido.
            </p>
            <div className="landing-actions">
              <Link className="button" to="/painel?cadastro=1">
                Criar minha conta <ArrowRight size={18} />
              </Link>
              <a className="text-button" href="#como-funciona">
                Conhecer por dentro
              </a>
            </div>
            <span className="landing-caption">
              Organize no seu ritmo. No computador ou no celular.
            </span>
          </div>
          <ProductPreview />
        </section>
        <section id="recursos" className="landing-section" aria-labelledby="landing-benefits-title">
          <div className="landing-section-heading">
            <span className="landing-kicker">DO DIA A DIA AOS PRÓXIMOS PLANOS</span>
            <h2 id="landing-benefits-title">Menos contas espalhadas. Mais clareza para decidir.</h2>
            <p>O que você gasta, o que está por vir e o que está construindo, no mesmo lugar.</p>
          </div>
          <div className="landing-features">
            {(
              [
                [
                  ArrowLeftRight,
                  'Entenda cada movimento.',
                  'Reúna suas contas, filtre os lançamentos e consulte seu histórico sem perder o contexto.',
                ],
                [
                  CalendarDays,
                  'Dê um destino ao seu dinheiro.',
                  'Planeje receitas e despesas, compare com o realizado e acompanhe os próximos vencimentos.',
                ],
                [
                  CreditCard,
                  'Enxergue além da próxima fatura.',
                  'Organize compras e parcelas. Vincule o pagamento ao débito que já está na conta.',
                ],
                [
                  FileText,
                  'Traga seu extrato para a conversa.',
                  'Importe arquivos, revise os dados e confirme os lançamentos antes de incorporá-los ao histórico.',
                ],
                [
                  ChartNoAxesCombined,
                  'Acompanhe o que você constrói.',
                  'Consulte investimentos e patrimônio junto da organização do seu dia a dia.',
                ],
                [
                  Layers,
                  'Separe o que precisa de contexto.',
                  'Organize espaços financeiros e acompanhe contas de dinheiro, benefícios e reservas.',
                ],
              ] as const
            ).map(([Icon, title, description]) => (
              <article key={title}>
                <Icon size={21} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="como-funciona"
          className="landing-section"
          aria-labelledby="landing-steps-title"
        >
          <div className="landing-section-heading">
            <span className="landing-kicker">UM PASSO DE CADA VEZ</span>
            <h2 id="landing-steps-title">Você não precisa organizar tudo de uma vez.</h2>
            <p>Comece com uma conta. O restante vai encontrando seu lugar.</p>
          </div>
          <ol className="landing-steps">
            <li>
              <span aria-hidden="true">01</span>
              <h3>Monte seu espaço.</h3>
              <p>Crie sua conta e cadastre as contas e os cartões que fazem parte da sua rotina.</p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <h3>Traga seus movimentos.</h3>
              <p>
                Adicione lançamentos ou importe um extrato. Revise, categorize e entenda o seu ponto
                de partida.
              </p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <h3>Planeje e acompanhe.</h3>
              <p>
                Defina seu mês e compare o previsto com o realizado. Ajuste os próximos passos com
                mais contexto.
              </p>
            </li>
          </ol>
          <Link className="text-button landing-inline-link" to="/painel?cadastro=1">
            Dar o primeiro passo <ArrowRight size={16} />
          </Link>
        </section>
        <section
          className="landing-use-case landing-section"
          aria-labelledby="landing-use-case-title"
        >
          <div className="landing-section-heading">
            <span className="landing-kicker">UMA VISÃO, VÁRIAS DECISÕES</span>
            <h2 id="landing-use-case-title">
              Seu saldo conta uma parte. Seu planejamento conta o resto.
            </h2>
            <p>
              Ter dinheiro na conta e ter dinheiro disponível para gastar são coisas diferentes.
              Conecte o saldo de hoje às despesas, faturas e planos do mês.
            </p>
            <a href="#planos" className="text-button landing-inline-link">
              Encontrar meu plano <ArrowRight size={16} />
            </a>
          </div>
          <ul className="landing-outcomes">
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Compare o que planejou com o que aconteceu.</span>
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Veja os pagamentos que ainda vão passar pela conta.</span>
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Separe o dinheiro do dia a dia das reservas.</span>
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>Acompanhe seu patrimônio com perspectiva.</span>
            </li>
          </ul>
        </section>
        <Plans />
        <section
          id="duvidas"
          className="landing-section landing-faq"
          aria-labelledby="landing-faq-title"
        >
          <div className="landing-section-heading">
            <span className="landing-kicker">ANTES DE COMEÇAR</span>
            <h2 id="landing-faq-title">Algumas respostas para o seu primeiro passo.</h2>
          </div>
          <div className="landing-faq-list">
            {[
              [
                'Preciso cadastrar tudo para começar?',
                'Não. Comece por uma conta e pelos movimentos que quer acompanhar. Você pode adicionar cartões e organizar o planejamento aos poucos.',
              ],
              [
                'Preciso conectar minha conta bancária?',
                'Você pode registrar movimentos manualmente ou importar arquivos de extrato. A importação passa por revisão antes da confirmação dos lançamentos.',
              ],
              [
                'Consigo usar pelo celular?',
                'Sim. A plataforma se adapta ao computador, tablet e celular, com os mesmos dados da sua conta.',
              ],
              [
                'O pagamento do cartão vira outra despesa?',
                'As compras e o pagamento da fatura têm papéis diferentes. O pagamento pode ser vinculado ao lançamento da conta, sem repetir o débito que já está no extrato.',
              ],
              [
                'Já posso contratar um plano pago?',
                'Ainda não. Os planos pagos estão em preparação. Os valores, os recursos e os limites serão apresentados antes de qualquer contratação.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-final landing-section" aria-labelledby="landing-final-title">
          <span className="landing-kicker">COMECE PELO SEU PRÓXIMO PASSO</span>
          <h2 id="landing-final-title">Faça espaço para os seus planos.</h2>
          <p>Seu dinheiro pode ser mais fácil de entender. Comece a organizar o seu mês.</p>
          <Link className="button" to="/painel?cadastro=1">
            Criar minha conta <ArrowRight size={18} />
          </Link>
          <Link className="text-button landing-inline-link" to="/painel">
            Já tenho uma conta
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <span>{productName} · Um mês de cada vez.</span>
        <ThemeSwitcher />
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
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
  );
}

function Plans() {
  return (
    <section id="planos" className="landing-section" aria-labelledby="landing-plans-title">
      <div className="landing-section-heading">
        <span className="landing-kicker">ESCOLHA COMO COMEÇAR</span>
        <h2 id="landing-plans-title">O primeiro passo está disponível agora.</h2>
        <p>
          A oferta paga está em preparação. Conheça a plataforma enquanto os próximos planos ganham
          forma.
        </p>
      </div>
      <div className="landing-plans">
        <article className="landing-plan">
          <span className="landing-plan-status">Disponível agora</span>
          <h3>Acesso inicial</h3>
          <p>Para começar a organizar sua vida financeira com a plataforma atual.</p>
          <ul>
            {[
              'Contas e movimentações',
              'Cartões, faturas e parcelas',
              'Planejamento e vencimentos',
              'Importação e revisão de extratos',
              'Visão de investimentos e patrimônio',
            ].map((feature) => (
              <li key={feature}>
                <Check size={16} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <Link className="button" to="/painel?cadastro=1">
            Começar agora <ArrowRight size={16} />
          </Link>
          <small>Cadastro disponível. Nenhuma assinatura paga é contratada nesta etapa.</small>
        </article>
        <article className="landing-plan">
          <span className="landing-plan-status landing-plan-upcoming">Em breve</span>
          <h3>Próximos planos</h3>
          <p>Novas opções para acompanhar a evolução da sua organização financeira.</p>
          <div className="landing-plan-pending">
            <strong>Uma oferta bem definida, antes de qualquer escolha.</strong>
            <p>
              Preços, recursos e limites ainda estão em definição. A contratação estará disponível
              quando esses detalhes forem publicados.
            </p>
          </div>
          <a className="text-button landing-inline-link" href="#duvidas">
            Tirar minhas dúvidas <ArrowRight size={16} />
          </a>
        </article>
      </div>
    </section>
  );
}
