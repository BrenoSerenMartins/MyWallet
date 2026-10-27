# Dependencies

- Supabase is the selected managed database provider. Project reference: `hlcrjoqmyohfbajvafhh`.
- Supabase CLI is installed as an npm development dependency; `package-lock.json` records its resolved version. Run through `npx --no-install supabase`.
- CLI initialization is complete. The user subsequently completed account authentication and project linking in their terminal and supplied the successful CLI output.
- Earlier agent-runtime requests failed with Node DNS `EAI_AGAIN`; remote commands may need to run in the user's terminal if this environment limitation persists.
- This environment has a read-only home directory. Prefix CLI commands with `SUPABASE_HOME="$PWD/.supabase-cli" SUPABASE_NO_KEYRING=1 SUPABASE_TELEMETRY_DISABLED=1`. The private directory is excluded from version control.
- Local credentials and connection settings live in ignored `.env.local`; `.env.example` lists required variables without secrets. Load `.env.local` into the CLI process environment when linking; the saved database password is not a Supabase account access token.
- React/Vite, Nest, Supabase Auth, pg, PDF.js, TanStack Query, Radix Dialog, and Lucide are installed; the workspace lockfile pins resolved versions. OpenAPI types are generated for the frontend. TypeScript 5.9 is selected for compatibility with the OpenAPI type generator.

## Runtime dependency direction
The [pilot plan](../architecture/pilot-plan.md) describes the implemented direction. The user verified database provisioning; Render was selected for combined frontend/API hosting; its Blueprint is prepared, but the hosted service/account connection remains unconfigured.

| Consumer | Dependency | Boundary |
| --- | --- | --- |
| PWA business features | MyWallet REST | Central HTTP client; generated OpenAPI transport types |
| PWA authentication | Supabase Auth SDK | Public URL/key only; no business data access |
| Nest modules | Core auth/config/database/HTTP | Public core exports, verified user/workspace scope |
| Imports | Account reads and ledger import port | Contracts in core/integration, bindings in composition; shared transaction for commit |
| Ledger | Account/category validation ports | Owning modules retain metadata writes and access rules |
| Planning | Category reads and grouped ledger actuals | Monthly read projection; writes only planning tables |
| Data export | Planning backup port | Version 2 plans with category remapping, month conflict rollback |
| Dashboard | Account/ledger read ports | Read-only composition; no balance mutations |
| Data export | Domain export/restore ports | Owning modules validate/write records within the restoration transaction |
| Institution mapper | Normalized import contract | Institution-specific interpretation; no repository or UI dependency |
| API repositories | PostgreSQL through restricted runtime role | Owner/workspace-scoped parameterized SQL and verified TLS |

The `core` cannot import business modules. Business modules cannot import one another's implementations or write another module's tables. Composition imports the intentional public exports and wires real integration ports. No source dependency on Tastly is introduced.

## Tabular account-statement readers
The API uses csv-parse 7.0.3 for quoted CSV, read-excel-file 9.3.12 (universal entry in its worker) for XLSX cell data and unzipper-esm 0.13.3 for archive-directory size checks. These are server runtime dependencies only. fflate is an explicit development dependency for synthetic XLSX test generation. Keep workers and their MJS reader modules included in API builds. No external data provider or browser workbook parser is introduced.

Counterparties provides the COUNTERPARTY_RULES port for batch suggestions, explicit learning and snapshot restore. Ledger owns transaction identity/category persistence and retroactive updates. CounterpartyRulesWorkflow consumes LEDGER_WRITES for applying a relation under an account lock and shared transaction, avoiding a service dependency cycle. Imports supplies source kind/store IDs and immutable transaction proof; counterparties never supplies evidence to the reconciliation matcher.

Consumer import policy removes the ACCOUNT_OPENING_POSITIONS integration port and its account initializer. Imports retain ACCOUNT_READS, LEDGER_READS/WRITES and COUNTERPARTY_RULES; legacy EDI readers do not expose new public financial ingestion.
