# Next-cycle execution status

Updated: 2026-11-05. Implements the order in [the action plan](action-plan-next-cycle.md).

## Baseline captured

- `npm run verify`: passed, 36 suites / 232 tests, API/app types and production builds, module boundaries and frontend credential scan.
- `npm run contracts:check`: passed; generated OpenAPI and transport types are current.
- Strengthened existing managed-finance recovery test: compare all named account balances, card debt/credit/available limit, cashflow projections, planning totals and net worth after restoring into another owner. Repeat restoration must preserve the same financial state without adding transactions; restored IDs differ from the source. Targeted suite passed: 19 tests.
- Browser suite: 134 tests discovered. Discovery is not execution.
- Local browser execution fails before tests: loopback connection EPERM and Chromium sandbox shutdown `Operation not permitted`. Explicit `--no-sandbox` does not resolve the host restriction. GitHub API is also inaccessible here; remote results cannot be inspected by this agent yet.

## Changes in this increment

- Replaced stale expectations for retired expense breakdown, account tabs, per-page header count and old control placement.
- Preserved assertions for financial values, date presets and filtered requests, keyboard focus and task access.
- Configured loopback server consistently, traces/screenshots retained on failure and an HTML report in CI.
- Browser CI runs independently in three shards, with reports uploaded even after failure, so a separate audit failure cannot suppress browser evidence.
- Corrected current-scope claims in README, architecture overview and frontend routes.
- Defined the sharing permission matrix and compatibility model in [workspace permissions](workspace-permissions-plan.md). This is design, not a change to runtime authorization.

## Open verification gate

Phase 1 remains in progress until browser CI runs successfully and failures are triaged. Device validation of keyboard/safe-area behavior remains separate from emulated viewport assertions. The agent requested the Quality/Playwright result from the user because local browser execution and GitHub API access are blocked.

Do not report the full plan complete. No new financial schema or migrations have been introduced in this increment. Goals, persistent alerts and sharing remain planned; recognition candidates already exist, and their review improvements remain planned.

## Next executable actions

1. Inspect each uploaded browser report; repair actual application regressions and remaining obsolete expectations without weakening task/financial assertions.
2. Run the recovery/isolation/browser matrix in a real allowed environment and record evidence.
3. Consolidate the CSS cascade component by component against that baseline.
4. Implement goals/reserve allocation with tested migrations, atomic allocations and backup support, then proceed in the published plan order.

## CI failure triage — 2026-11-05

User supplied the complete browser shard 3 log for run 42043543242 (commit aeace7e). It ran 44 tests: 27 passed, 17 failed. The 320/390/768px all-destination layout audits, viewport-pinned mobile navigation, quiet task actions and movement-filter panel checks passed. These are CI results, not a physical-device review. Logs for shards 1/2 and the verify job have not yet been supplied.

Confirmed causes addressed:

- Native summary controls were not found as buttons in the CI browser. ActionMenu now explicitly exposes button role and expanded state while retaining native details activation.
- Label-only test selectors matched both the combobox and its still-mounted closing popup. Shared test control helpers now restrict their target to the actual input/combobox.
- A nominal 44px hit target measured 43.999992px during rendering. The geometry assertion rounds to hundredths before applying the unchanged 44px threshold.
- A date-filter test asserted page content while the modal was still open. It now closes through Ver movimentos before checking the list.
- During placeholder pagination, the action can be absent instead of disabled. The test still requires it to be unavailable, preserves the old inert ledger assertion and checks that no old cursor is reused.

A fresh local production dependency audit separately reproduced two high-severity findings through multer 2.4.0 and Nest's Express adapter. The lockfile now resolves @nestjs/platform-express 12.3.3 with multer 2.5.0 (and required tslib 2.9.1), within the existing package constraints. Installed versions verified; `npm audit --omit=dev` reports zero vulnerabilities. Advisory: https://github.com/advisories/GHSA-q7qp-rjg7-q26m. No forced unrelated dev-tool upgrades were applied.

Browser rerun remains required. Local Playwright still fails at server startup under host restrictions; no tests have been disabled to obtain a pass.

### Complemento dos logs dos shards 1 e 2

Os logs do run 42043543242 confirmam que verify passou lint, tipos, limites, 232 testes, build e contratos; a falha final foi o audit de multer, já corrigido no commit 3d27bb8. Atualizados os testes que ainda usavam filtros, navegação e resultado de previsão anteriores à interface atual. O teste de Escape verifica a dispensa da tooltip antes de fechar o menu. O cenário de texto a 200% recebeu ajustes de largura intrínseca e quebra de texto nos cartões e diagnóstico dos elementos que ultrapassam o viewport. A execução real do navegador continua pendente no CI, pois o ambiente local bloqueia Chromium/servidor de testes. Não considerar a etapa de estabilização concluída antes desse resultado.

### Diagnóstico por trace do run 42070686256

O artefato browser-test-evidence-3 confirmou que o clique em Cartões e faturas era interceptado pelo combobox Tipo de conta do conteúdo principal. O cabeçalho não criava uma camada acima do conteúdo animado. Adicionado position relative e z-index 50 ao cabeçalho; os diálogos e popovers portados mantêm suas camadas próprias. O teste continua navegando por cliques reais, sem force. Notificações: os quatro cenários passaram após isolar suas medições das animações de entrada. Resta confirmar a navegação no novo CI.

### Competência de benefícios em consultas por período

A configuração continua exclusiva de VA/VR. A data de competência usada no planejamento passou a ser compartilhada pelos totais do dashboard, séries mensais dos gráficos e filtros de movimentações. Apenas créditos positivos classificados como receita em benefício configurado para o mês seguinte mudam de período; despesas e demais contas mantêm o critério original. Datas persistidas, conciliação com extratos e cálculos de saldo continuam usando a data bancária. Alterar a configuração invalida também gráficos, dashboard e listas em cache. Teste integrado verifica o mesmo crédito nos totais, histórico, filtro por conta e paginação, preservando sua data original e saldo.

Validação local: 27 testes de planejamento e fluxos financeiros passaram; tipos, lint, limites de módulos, build e verificação de credenciais passaram. A suíte completa não avançou neste ambiente e foi interrompida; sua confirmação, assim como os testes de navegador, fica pendente no CI.

## Execução do plano de saldo trazido — 2026-11-05

Implementados contratos derivados de posição histórica/atividade por período, sem novas receitas, migrations ou snapshots persistidos. A leitura percorre apenas a linhagem ativa das referências de saldo; períodos sem referência suficiente ficam incompletos. Correções são ajustes separados da receita. Contas arquivadas permanecem na leitura histórica; reservas, cartões e contas de investimento não entram no saldo disponível de consumo. O resultado econômico do mês permanece separado dos fluxos de caixa disponíveis, inclusive para pagamentos de fatura.

Planejamento e resumo mostram saldo trazido, disponível final, previsão após a meta de poupança e composição por conta. Aportes/resgates líquidos identificados por transferências ficam discriminados, sem descontar o aporte duas vezes. Histórico recebe saldos de abertura/fechamento calculados em lote e uma série própria de disponível. Movimentações indicam competência diferente da data original; exportação CSV percorre todas as páginas dos filtros e preserva ambas as datas, com cancelamento na troca de espaço e escape de fórmulas em texto.

Validação: `npm run verify` passou com 37 arquivos/237 testes; contratos atuais; testes de integração de três meses, antecipação consumida, reservas, correção manual, conta arquivada, mudança de competência, virada de ano, período parcial bissexto e ausência de referência passaram. Adicionados cenários de navegador para saldo trazido/privacidade em 390/1440px e CSV paginado. A execução local do navegador falhou ao iniciar webServer; CI e conferência em aparelho real continuam pendentes. Não declarar a validação integrada concluída sem esses resultados. Metas/alocações virtuais do ciclo mais amplo não foram criadas por esta entrega.

Verificação adicional de restauração: os 19 testes do módulo de planejamento passaram após acrescentar backup/restauração do saldo trazido. A restauração reproduziu os totais com os mesmos dois fatos financeiros, sem criar lançamentos mensais, e o espaço de destino começou sem dados do espaço de origem.

## Reforma da entrada — desktop e mobile

Login, cadastro e recuperação receberam composição editorial própria: marca no cabeçalho, apresentação com desenho vetorial no desktop, formulário aberto com divisória discreta, controles de 44/54px e opções de tema no rodapé. Em telas de até 800px, a apresentação é curta e os elementos decorativos são removidos para priorizar o formulário. Foram eliminadas 315 linhas de estilos antigos de autenticação. Fluxos de autenticação permanecem nos métodos existentes; alternar modo também oculta a senha novamente.

Validação: lint, tipos/build do app, formatação e verificação de credenciais passaram. Adicionados cenários de 320, 390, 768 e 1440px com temas, visibilidade de senha, cadastro, recuperação e viewport baixo; a suíte agora lista 141 testes. Screenshots por tema/tamanho ficam nos resultados desses cenários no CI. Execução visual pelo navegador e conferência em aparelho continuam pendentes neste ambiente.

## Relação entre contas, cartões e planejamento — 2026-11-05

Dívidas anteriores podem ser adicionadas separadamente, inclusive à mesma fatura; cada inclusão soma apenas o valor ainda não registrado. Pagamentos vinculam também débitos importados sem classificação. A lista e o detalhe da movimentação mostram a fatura vinculada e distinguem a conferência por arquivo, sem marcar conciliação bancária artificialmente. Ao desfazer um vínculo novo, o tipo e a categoria originais são restaurados. Backup v11 preserva essa origem e remapeia suas categorias na restauração; backups anteriores permanecem aceitos.

Planejamento oferece uma simulação opcional das faturas pendentes por conta de pagamento, baseada nos saldos atuais, com seleção inicialmente vazia e atalho para registrar/vincular o pagamento. Não persiste seleção, não cria compromissos duplicados e não soma pagamentos como novas despesas. A previsão completa continua em Vencimentos.

Validação: `npm run verify` passou com 37 arquivos/239 testes, incluindo múltiplas dívidas, vínculo de débito sem classificação, desfazer e restauração da origem por backup; contratos atuais. Incluídos dois cenários de navegador para simulação e acesso direto ao pagamento. Migração `202611050001_card_payment_origin.sql` necessária antes de publicar a API; execução local falhou ao resolver o host do Supabase (`EAI_AGAIN`). Não foi aplicada remotamente.

## Home pública e acesso ao painel — 2026-11-05

A home de visitantes apresenta a plataforma em uma landing com prévia ilustrativa do painel e acesso explícito ao painel. `/painel` e `/login` exibem uma tela própria de autenticação: logo acima do card centralizado, identidade visual e temas compartilhados com o sistema. A home autenticada continua sendo a visão geral financeira. Cadastro, recuperação e redefinição mantêm seus fluxos existentes.

Lint e build passaram. A suíte lista 147 cenários, incluindo quatro novos para navegar da landing ao card centralizado em 320/390/768/1440px. A tentativa de executar esses cenários falhou ao iniciar `webServer`, antes de abrir o navegador; screenshots e validação visual continuam pendentes no CI.

## Download da consulta CSV — ajuste após CI

CI informado pelo usuário: 46 cenários passaram e a exportação CSV expirou esperando download. O exportador agora usa um link conectado ao DOM dentro do diálogo e mantém a URL do arquivo por 60 segundos; o estado de exportação também é liberado após cancelamento por troca de espaço. O teste verifica os cursores das duas páginas, ausência de erro no diálogo e nome do arquivo antes de validar seu conteúdo. A causa exata do timeout anterior não foi confirmada por trace.

Lint, build do app e teste unitário de serialização passaram. A execução local do cenário de navegador falhou ao iniciar webServer; confirmação da alteração permanece pendente no CI. A migração dos cartões continua necessária antes da publicação conjunta da API.
