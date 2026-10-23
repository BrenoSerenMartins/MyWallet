# Architecture overview

## Purpose
Record the implemented pilot and its current verification limits.

## Current state
The user authorized execution of the pilot plan. The repository now contains npm workspaces for React/TypeScript/Vite in `app/` and a modular Nest API in `api/`, using Supabase Auth and PostgreSQL. The user supplied successful output from `npm run db:setup`: the initial migration was applied and the restricted runtime login was verified over TLS. No personal financial records were imported remotely by the agent.

## Responsibilities and flow
The browser uses Supabase directly for authentication only. Business requests carry a verified user token and `X-Workspace-Id` to REST `/v1`. The API validates workspace ownership and binds both identities transaction-locally; RLS and composite references isolate workspaces even for the same user. Controllers validate and dispatch; services implement financial workflows; repositories execute parameterized SQL inside a verified user transaction. RLS and composite ownership references protect data. Business modules communicate through narrow core contracts wired in composition, following the inspected Tastly organization without sibling source dependencies.

Frontend features compose focused components and data hooks. Theme/auth/workspace contexts and TanStack Query hold the shared state. A separate financial query cache and remounted screens prevent data from surviving a workspace switch; only the selected ID is remembered locally per user. Light/dark/system themes use semantic tokens. The PWA caches static assets, not financial responses or authentication endpoints. Financial operations require connectivity.

## Implemented scope
Workspace selection/creation through cards, accounts/opening positions, categories, income/expenses, atomic transfers, history/filtering, corrections/reversals, monthly summaries, Mercado Pago PDF review/confirmation/reversal, JSON financial backup/restore, and CSV export. Investment accounting, full net worth, goals/reserve planning, card billing, offline synchronization, and bank connections remain deferred.

## Infrastructure and checks
A root `wrangler.jsonc` explicitly targets `app/dist` with SPA asset routing, resolving monorepo autodetection for Cloudflare frontend deployments. Cloudflare build/deploy/check commands are separate from the Node deployment command. This does not deploy Nest or provide a production `/v1` proxy; the user subsequently selected the combined Render Docker service instead of requiring this separate frontend path. The frontend build and credential scan passed; Wrangler 4.152.0 dry-run recognized 25 static assets and exited successfully. No Cloudflare publication has been verified by the agent.

The user selected Render: its Blueprint explicitly deploys main as one free Docker service serving API plus built frontend from one Node process, port 10000 and readiness at /ready. Root README includes the deployment link and required public Auth/restricted database settings. The user attempted a Render deployment of e5a0f49: Nest started and port 8083 was detected, but deployment failed after roughly 15 minutes. The user supplied https://mywallet-pilot.onrender.com; external health/ready probes timed out without an HTTP response. A subsequent screenshot for a98ab65 shows Render probing :10000/ready while the deployed configuration used 8083. Blueprint PORT and Docker defaults/EXPOSE now align on 10000, and bootstrap logs the effective listener. This addresses the observed configuration mismatch; database readiness still needs hosted confirmation. Existing services must sync the Blueprint or update PORT in their dashboard. Local development/Compose remain on 8083. The agent has not created a hosted service. The public Supabase Root 2021 CA is included and used with certificate verification. Database setup and migration commands are documented in the root README. `npm run deploy` validates/builds, runs the existing TLS-verified database setup, reloads runtime credentials and starts the built API/PWA in the foreground. `--prepare-only` omits startup. Normal deployment checks port availability before building/migrating; `--port=8084` explicitly overrides the listening port. The user subsequently reached production startup after setup, but startup failed because port 8083 was occupied. It requires database connectivity and does not publish hosting or configure browser HTTPS.

At the recorded verification point, 26 tests passed, covering money parsing, source mapping, JWT claim boundaries, RLS/ownership, financial transfers, retry receipts, corrections, restore, and read-only/nested transaction behavior. The actual local PDF reconciled 315 movements including 65 reserved-money transfers. Tests use disposable PostgreSQL through PGlite; real concurrent PostgreSQL sessions are not covered by those tests.

Nest and Vite startup were observed. All six Playwright tests passed with synthetic Auth/API fixtures, covering themes, financial screens and workspace cards at 360/390/768/1440 px, workspace creation and the selected request header. Lint, types, module boundaries, build, secret scan and generated-contract checks passed. Mobile financial summary columns now shrink and wrap without horizontal overflow; real hosted Auth/email flows, real-device PWA installation, and a personal end-to-end import still require verification. Do not treat the implementation as a fully homologated hosted release.

Migration `202610220002_workspaces.sql` backfills existing data into the owner’s default “Pessoal” space. Its local PostgreSQL tests passed; remote application remains pending because the agent database command fails with DNS `EAI_AGAIN`. The deployment preparation command passed lint/types/boundaries, all 26 tests, builds and the secret scan, then exited with status 1 on `EAI_AGAIN` during database setup; application startup was not attempted. Workspace sharing and invitations are outside the implemented scope.

## References
- [Pilot plan](pilot-plan.md): approved direction, phases and remaining acceptance criteria.
- [Design system](design-system.md): visual tokens, responsive surfaces and themes.
- [Personal finance](../domains/personal-finance.md): product scope and financial rules.
- [Statement imports](statement-imports.md): institution mappers and source constraints.
- [Routes](../maps/routes.md), [database](../maps/database.md), and [dependencies](../maps/dependencies.md): implemented boundaries and outstanding work.

## Readiness diagnostics
Database readiness records transitions using allowlisted network/TLS/PostgreSQL error codes, missing runtime configuration and invalid/elevated runtime role. No raw error message, connection URL or credentials are logged. Public health/readiness response contracts and financial transactions are unchanged; duplicate failures are suppressed until the state changes. The checks remain strict rather than releasing a service that cannot access its database.

For the readiness change, lint/types/boundaries, production builds and credential scan passed. All 32 tests passed, including six readiness cases; a direct local runtime probe logged EAI_AGAIN without connection details. This local DNS failure does not establish the hosted failure reason.
