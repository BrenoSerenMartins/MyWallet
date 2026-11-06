# Evidência local do ciclo de 2026-11-06

- `npm run verify`: aprovado. Lint sem avisos, TypeScript nos dois workspaces, limites de módulos, 263 testes em 40 arquivos, build de API/frontend e verificação de credenciais no frontend.
- `npx vitest run api/src/modules/cards/tests/managed-finance.spec.ts api/src/modules/counterparties/tests/counterparty-rules.spec.ts`: 48 aprovados após ampliar os testes de isolamento de alertas, proteção RLS de leitor e convites expirados.
- `npm run contracts:check`: aprovado; OpenAPI e tipos frontend atuais.
- `npm run test:e2e -- --list`: 161 cenários reconhecidos, incluindo metas e revisão assistida em 390/1440 px.
- `npm run test:e2e -- --grep 'goals allocate existing money'`: não executou testes, pois o webServer não conseguiu iniciar neste ambiente. Não há evidência de aprovação em Chromium nesta sessão.
- Migrations validadas em PGlite com papel restrito. PostgreSQL com conexões concorrentes e ambiente publicado não foram validados aqui.

Antes de publicar: aplicar `npm run db:migrate` no ambiente com conectividade ao banco. As novas migrations vão de `202611060002_account_category_defaults.sql` até `202611060009_manual_category_choice.sql`. Aplicar somente as migrations sem publicar mantém a versão anterior compatível.
