# Architecture decisions

- Use `knowledge/` as the project knowledge base; no Obsidian vault was found during initialization.
- Prefer simple, explicit implementations. Introduce abstractions only for existing duplication or real architectural boundaries.
- Start with a responsive PWA and manual statement uploads, as selected by the user. Reading other applications' notifications is outside the initial scope.
- Launch for personal use while accommodating future separate user accounts with isolated financial data. Hosting, authentication, synchronization, and household sharing are not selected or implied by this requirement.
- The user subsequently selected Supabase hosted PostgreSQL and requested CLI initialization and project linking. Keep credentials in ignored local configuration; do not include database credentials in the PWA.
- Each institution has its own statement mapper into a shared semantic financial model. Separate source extraction, institution interpretation, import validation, and persistence. Do not use bank-specific field names as the app's financial model. See `statement-imports.md` for terminology and verified Mercado Pago sample constraints.
- Product scope and release phases are recorded in `knowledge/domains/personal-finance.md`. Proposed additions are distinguished from user-requested capabilities.
- The user requested an immersive fintech/banking visual direction with theme switching. Proposed tokens and interaction rules are in `design-system.md`.
- The user requested a complete design/infrastructure/code execution plan using the sibling Tastly backend structure as a reference. `pilot-plan.md` records the inspected patterns, adapted Nest module boundaries, hosting implications, sequence, and acceptance criteria. Technical choices remain proposals until implementation, and no Tastly code or configuration is copied.
- Record future decisions here with their context and consequences.

- The user authorized pilot implementation. Use React/Vite plus a modular Nest API and Supabase Auth/PostgreSQL; only Auth is accessed directly from the browser. Public REST shapes generate frontend types from OpenAPI. TypeScript 5.9 satisfies the selected generator's peer contract.
- User provisioning confirmed that Supabase requires its root CA in this environment. Include the public Supabase Root 2021 CA (SHA-256 `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`) from the sibling's existing public CA file; verify TLS in every database client. No sibling credential was copied.
- The pilot's explicit migration runner owns `mywallet_migrations.applied`; do not combine it with CLI `db push` history. Hosting files are prepared but publication requires a configured hosting account and actual hosted acceptance checks.

- The user requested workspace selection through Trello-like cards. Workspaces remain private to their owner; shared membership is not introduced. Migration 002 preserves existing financial records under “Pessoal”. Financial tables require owner and workspace scope, with triple composite references to prohibit cross-space relationships. The API validates `X-Workspace-Id`; owner-only workspace listing/creation explicitly runs without financial scope. Frontend workspace switching replaces its financial QueryClient and screen state.
