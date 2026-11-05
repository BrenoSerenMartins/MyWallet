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
