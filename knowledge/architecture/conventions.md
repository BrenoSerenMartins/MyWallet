# Engineering conventions

- Write code and descriptive identifiers in English.
- Keep functions, files, and components focused on one responsibility.
- Prefer early returns, low nesting, composition, and local state.
- Keep handlers limited to input validation, service calls, and response mapping.
- Keep business rules in services or use cases, persistence in repositories, and integrations in dedicated clients.
- Before implementation, identify affected modules, rules, integrations, database changes, public API changes, and regression risks.
- Preserve public APIs unless a change is requested.
- Update relevant knowledge notes when behavior or architecture changes.
- Verify changes with proportionate checks; avoid tests that merely mirror implementation.

## Planned implementation standards
- Follow the module boundaries described in [the pilot plan](pilot-plan.md); do not import code from the Tastly sibling repository.
- TypeScript and HTTP JSON use camelCase properties; SQL tables/columns use snake_case; files and directories use kebab-case. Classes/types use PascalCase; functions and variables use camelCase. UI text and the root README are Brazilian Portuguese; code identifiers and internal architecture notes are English.
- Each module/core area exports its deliberate external surface through `index.ts`. Business modules communicate through narrow integration ports wired in composition; core never imports business implementations. Do not use `forwardRef` to hide a dependency cycle.
- Keep controllers focused on transport and DTO validation, services on financial workflows, repositories on SQL, and mappers on representation conversion.
- Avoid generic `BaseService`, catch-all helpers, and dynamic repositories. Extract shared behavior only after concrete reuse or an established boundary.
- Financial amounts are exact integer minor units for initial BRL support. The backend owns balance, transfer, deduplication, and import-confirmation rules. UI validation improves input, not authorization.
- Use `transactionDate` for a source date without a time; never fabricate midnight UTC or derive a posting date from unrelated metadata.
- Generated OpenAPI transport types prevent frontend/backend contract drift. Database rows remain internal and map explicitly to API resources.
- Paginated lists have stable ordering with an ID tie-breaker, bounded limits, allowlisted filters, and an explicit continuation cursor. Use version checks on mutable financial records and persisted idempotency for financial confirmation commands.
- Shared frontend UI depends on visual contracts; feature data hooks call a central REST client. Server-state caches are keyed by user and relevant filters. Each active workspace owns a separate QueryClient, cleared on workspace change; screens remount on workspace change. Capture the request workspace before asynchronous authentication.
- Root commands should offer `dev`, `build`, `lint`, `format:check`, `typecheck`, `test`, and `verify`; tests and OpenAPI generation also have workspace commands. Select and configure actual tools during scaffolding, keeping CI and local commands aligned.
- Use focused commits and concise PR descriptions covering behavior, verification, schema/API impact, and material risks. Do not enforce arbitrary coverage percentages instead of testing financial and isolation invariants.
