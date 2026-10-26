# Routes

The pilot implements the routes below, published in `api/openapi.json`. Generated frontend transport types live in `app/src/shared/api/generated.d.ts`. Transaction details currently open in a dialog from the history screen, rather than a separate frontend detail URL.

## Frontend
| Route | Feature |
| --- | --- |
| `/sign-in`, `/sign-up` | Authentication |
| `/auth/callback`, `/forgot-password`, `/reset-password` | Verification and account recovery |
| `/workspaces` | Workspace card selection and creation |
| `/` | Home/dashboard |
| `/accounts`, `/accounts/:accountId` | Owned accounts and history |
| `/planning` | Monthly budgets, actual comparison, notes and prior-month copy preview |
| `/transactions` | Filtered history and transaction detail |
| `/imports`, `/imports/:importId` | Upload, review, confirmation and history |
| `/settings`, `/settings/categories`, `/settings/data` | Theme, categories and export/restore |

Authenticated routes handle session loading and expiration explicitly; client routing is not an authorization boundary.

## REST
| Endpoint | Owner and intent |
| --- | --- |
| `GET /health`, `GET /ready` | Process liveness and database readiness |
| `GET/POST /v1/workspaces` | Workspaces: list owned spaces/provision default and create a private space |
| `GET /v1/me` | Profiles: authenticated user context |
| `GET/POST /v1/accounts` | Accounts: list/create owned accounts |
| `GET/PATCH /v1/accounts/:id` | Accounts: detail/update metadata or reviewed opening position |
| `GET/POST /v1/categories`, `PATCH /v1/categories/:id` | Categories: list/create/update; category type is immutable |
| `GET/POST /v1/transactions` | Ledger: filtered list/manual entry |
| `GET/PATCH /v1/transactions/:id` | Ledger: detail/version-checked correction |
| `POST /v1/transactions/:id/reversals` | Ledger: explicit reversal with impact checks |
| `POST /v1/transfers` | Ledger: atomic pair of opposing account movements |
| `GET/PUT /v1/planning/:month` | Planning: month summary and complete version-checked budget replacement |
| `POST /v1/planning/:month/copies` | Planning: copy preceding month targets with expected source/target versions |
| `POST /v1/imports/:id/history` | Imports: retain normalized rows solely for consultation, without ledger writes |
| `POST /v1/imports/:id/reviews` | Imports: reopen retained history for explicit financial review |
| `GET/POST /v1/imports` | Imports: history/upload (PDF, CSV, XLSX account statements) and persisted review draft |
| `GET /v1/imports/:id` | Imports: review state, source/recorded opening positions, mismatch flag and receipt if confirmed |
| `PATCH /v1/imports/:id/items/:itemId` | Imports: reviewed corrections/selection with draft version check |
| `POST /v1/imports/:id/classifications` | Imports: user-invoked bulk classification proposal, preserving reserved-money transfers |
| `POST /v1/imports/:id/confirmations` | Imports: atomic, idempotent confirmation of the reviewed version |
| `POST /v1/imports/:id/reversals` | Imports: safe reversal of batch-owned movements |
| `GET /v1/dashboard?from=...&to=...` | Dashboard: period summary and coverage-aware balances |
| `GET /v1/exports?format=json\|csv` | Data export: versioned full backup or transaction analysis |
| `POST /v1/restores`, `GET /v1/restores/:id` | Data export: validate backup and preview restore impact |
| `POST /v1/restores/:id/confirmations` | Data export: reviewed atomic restore with retry protection |
| `GET /docs`, `GET /openapi.json` | OpenAPI, controlled by deployment configuration |

## Contract rules
- Financial endpoints require `X-Workspace-Id`; the server verifies ownership before entering the scoped transaction. Workspace listing/creation uses user scope only. Missing selection returns 400; another owner’s space returns 404.
- All business endpoints require verified user identity. Derive ownership server-side, never from a supplied `userId`.
- Lists return a consistent collection with continuation metadata. Errors use a safe Problem Details shape with stable machine-readable codes, field errors when appropriate, and a request ID.
- Require reviewed versions for import/restore confirmation and `If-Match` for financial edits. Persist idempotency keys/receipts for confirmations and atomic transfer creation; reject reuse with different input.
- Use 401 for absent/invalid identity, non-enumerating 404 for inaccessible owned resources, 409 for state/idempotency conflicts, 412 for stale versions, 413 for oversized uploads, and 422 for recognized but invalid financial input. DTO syntax errors use 400.
- Multipart upload and export endpoints are authenticated and never cached as public data. Limits, pagination, and date semantics are documented in generated OpenAPI.

Planning month keys are YYYY-MM, from 1900-01 through 9998-12. Save/copy bodies carry edit versions; copied targets do not copy transactions or overwrite target notes. GET import previews expose statement start/account opening dates, sourceFormat and a date mismatch flag. Historical rows remain separate from `/transactions` and financial summaries until explicit confirmation. These new fields/endpoints preserve the existing health and financial movement contracts.

Settlement CSV uses the same import endpoints. Previews add reportType, canIntegrate and nullable balances; items add typed nullable payment metadata. Settlement reports support draft/history consultation only: classification/item edits, confirmation and reviews for integration return conflicts. Account-statement workflows are preserved.

## Category hierarchy and review UX
- GET/POST /v1/category-groups and PATCH /v1/category-groups/:id operate in the Categories module with existing verified workspace scope. Group type is immutable.
- Categories accept optional nullable groupId (omitting it on update preserves the existing group) and return groupId/groupName. Planning lines include the same presentation metadata. Existing category IDs remain stable.
- Import items add derived duplicateLocked/duplicateReason. Attempts to edit proven duplicates return 409; confirmation automatically skips newly detected copies and returns skippedDuplicates.
- Financial JSON backup exports version 4 with categoryGroups and portable source evidence; restores accept v1/v2/v3/v4.
- Frontend /categories is the dedicated hierarchy screen; /settings/categories redirects there. Existing account/transaction/import routes remain. Preferences and imports have section switchers; mobile More opens a navigation dialog.

Default groups add isDefault to group resources. GET /v1/category-groups/:id/deletion-preview returns the category count, default destination and conflicting names. DELETE /v1/category-groups/:id atomically moves categories and returns deleted/movedCategories/destinationGroupId; inaccessible groups return 404 and default/conflicting deletions return 409. Existing nullable groupId input now resolves to the real matching default. Deletion always rechecks ownership and conflicts, independent of the preview.

Account resources add canEditOpeningPosition. Import previews add canAdjustOpeningPosition, openingDifference and up to five same-account previousImports with IDs, date ranges and draft/history status. Existing draft previews show automatic cash-flow defaults; confirmed receipts persist those types. Confirmation errors distinguish an editable first opening position from a prior-period reconciliation gap. No endpoint or schema is removed.

POST /v1/imports/:id/reprocess accepts version and optional resetClassification. POST /v1/imports/:id/reprocess-file accepts multipart file/version/resetClassification with existing 10 MB and bounded worker limits. Both return the refreshed preview and require owned workspace scope; confirmed/reversed batches return 409, stale versions 412 and wrong original hashes 422. Preview adds canReprocess. Neither endpoint confirms financial entries.

DELETE /v1/categories/:id archives the owned category and returns id/archived. Repeat requests are idempotent; cross-owner/workspace IDs return 404. Archived categories disappear from active category choices and fail new-entry validation, while existing ledger/planning records retain their references.

Planning totals add nullable incomeDifference, expenseDifference and resultDifference (income/result actual-minus-plan; expense plan-minus-actual). Virtual unassigned planning rows are labeled Outros with categoryId/groupId null and remain included in actual totals. No new category records or schema changes.

Settlement evidence reads (first enrichment slice): GET `/v1/imports/:id/matches` previews exact/ambiguous/unmatched/unsupported source correspondence; GET `/v1/imports/transaction-sources/:transactionId` returns retained matching details for an owned active movement. Both are scoped read-only operations. `/transactions?transaction=<uuid>` opens the transaction dialog, including complementary Mercado Pago details when present. The existing POST /v1/imports/:id/confirmations now supports settlement/EDI creation and reconciliation; history can reopen through the existing reviews endpoint.

Transaction GET/list resources expose reconciliationStatus (pending/reconciled); list accepts reconciliation=pending|reconciled. Import previews expose action, reason, compatible link candidates and existing transaction linkage; review accepts linkedTransactionId or explicit confirmNew. Both external source IDs and portable source-event facts are retained.

Alelo uploads use the existing POST /v1/imports and reviewed lifecycle; account institution is checked before extraction. Import previews add institution and reconciliationCapability (running_balance|partial); benefit_statement is a supported report type. Account types add benefit_food/benefit_meal. Dashboard adds benefitBalance/reserveBalance/recordedResources; balance now means recorded available cash excluding benefits/reserves. GET /v1/planning/:month accepts scope=all|cash|benefits (default all) for actuals only. POST /v1/accounts/:id/balance-adjustments records an idempotent reviewed manual current-balance correction with expectedBalance/targetBalance/reason.
