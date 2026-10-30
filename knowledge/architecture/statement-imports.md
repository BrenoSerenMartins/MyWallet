# Statement imports

## Current consumer import policy (2026-10-30)
The user superseded the EDI source-of-truth design. New uploads accept account/benefit statements only; EDI is rejected at source detection and the public confirmation/reprocessing routes reject retained settlements. Legacy parser/domain code remains solely for historical compatibility and integrity regression coverage, not a public ingestion path. Retained EDI views are read-only with an undo action for already-confirmed financial records. Existing amounts, proof, categories, identities and backups are preserved.

Account create/update no longer require opening fields. Legacy values remain optional/deprecated API inputs for compatibility and restore; missing values default internally on create and preserve existing values on update. The current audited balance-basis policy below supersedes the earlier prohibition on using source starting amounts: complete confirmed statements can establish a base, without asking for starting fields. No transaction date cutoff applies. Optional source balances validate source facts only and appear under collapsed source details. The generic normalized validation accepts missing balances and still checks supplied running/final balances and supplied totals. Institution-specific parsers retain their supported layouts; no unsupported generic format is implied.

Statement and benefit source evidence now establish transaction reconciliation when date and amount still match. It does not certify complete historical coverage or the account's current bank balance. Manual balance corrections remain auditable and outside income/expense totals. Agent management offers statement descriptions and manual origins; legacy merchant-ID aliases remain portable. Balance-basis migrations 202610300001/002 preserve existing totals while moving legacy correction transactions into audited base changes.

Earlier sections below document historical implementation decisions; EDI posting and previous opening/base policies are superseded by this policy and the current audited balance-basis section.

## Purpose
Convert institution-specific statement data into a consistent financial model. The pilot implements Mercado Pago account-statement PDF, CSV and XLSX parsers feeding one institution mapper and the shared financial contract. The initial schema has been applied by the user.

## Responsibilities
- Each institution owns its mapper. Different file formats or statement products may have separate parsers within that institution.
- Parsers extract source records and layout details. Institution mappers interpret those records and produce the shared import contract.
- The import service validates normalized records, reconciles totals, identifies locked source duplicates and ambiguous candidates, and prepares review. Financial categorization and persistence stay outside parsers and mappers.
- Repositories persist reviewed records. UI components present previews and corrections; they do not interpret bank descriptions.
- Add concrete modules for supported institutions only. Do not introduce a plugin framework or universal bank parser.

## Semantic model and naming
Use English financial terms in application contracts and snake_case database columns. Transport resources are declared in core integration DTOs and generated from OpenAPI for the frontend; examples below describe semantics.

| Concept | Example field | Meaning |
| --- | --- | --- |
| Financial account | `account_id` | Account owned by the authenticated user |
| Institution | `institution` | Source institution, such as Mercado Pago; separate from card brand |
| Source operation reference | `source_operation_id` | Institution-provided reference; not assumed unique per transaction |
| Transaction date | `transaction_date` | Financial event date; retain date-only precision when no time is supplied |
| Posting date | `posting_date` | Booking date, only when separately provided |
| Amount and currency | `amount`, `currency` | Exact money values; use integer minor units for initial BRL support |
| Direction | `direction` | Money entering or leaving the tracked account; does not determine income or expense by itself |
| Financial classification | `transaction_type` | Income, expense, transfer, or unresolved pending review |
| Description | `description` | Human-readable transaction description |
| Merchant | `merchant` | Merchant for a purchase, when identifiable |
| Counterparty | `counterparty` | Other party to a financial movement; not automatically a merchant |
| Card brand | `brand` | Card network, such as Visa or Mastercard, within card/payment context |
| Installment count | `installments` | Total number of installments, when known |
| Current installment | `installment_number` | Current installment's ordinal number, when known |
| Statement balance | `balance_after` | Source account balance after the movement, when supplied |

## Rules
- Unknown brand, merchant, installment information, time, or classification stays absent or explicitly unresolved. Do not invent values to fill the contract.
- Validate positive installment counts and ordinals; the current ordinal cannot exceed a known total. Do not assume an unknown count means a single payment.
- Preserve enough provenance to trace a normalized entry to its institution, source account, import batch, and source record. Do not store original PDFs by default.
- Internal transfers and reserved-money movements must not automatically become income or expense solely because their amounts are positive or negative.
- Duplicate checks are scoped to the owner, source account, and institution. A source operation ID alone is insufficient; review ambiguous candidates using additional transaction attributes.
- Detect an already imported source file separately from overlapping statements. Preserve multiple legitimate movements sharing an operation reference.
- Treat summaries as reconciliation inputs, not additional transactions. Reconstruct descriptions split across PDF lines and exclude repeated page headings/footers.
- Reject unsupported layouts clearly. Validate additional representative samples before claiming broad bank or format support.

## Mercado Pago sample findings
The user-provided PDF was inspected locally without adding it or extracted personal data to the repository.

- Institution confirmed as Mercado Pago; statement contains extractable text across 24 pages, so this sample does not require OCR.
- Columns: date, description, operation ID, amount, and running balance; descriptions can span multiple lines.
- Extracted 315 movements using a temporary layout inspection. All amounts parsed, every running balance reconciled, and opening balance plus movements matched the closing balance.
- Found 65 reserved-money movements and 18 yield entries; reserve movements need explicit transfer interpretation and review.
- Two operation references each occur on two distinct rows with different amounts and balances. Never enforce uniqueness on source operation ID alone.
- Inspection validates feasibility for this sample, not a production importer or coverage of other statement versions.

## Risks
Layout changes, incorrect line grouping, false duplicate removal, confusing transfers with expenses, and treating missing payment metadata as known.

## Implemented review behavior
File extraction runs in a bounded worker outside database transactions, with one concurrent extraction per user in this API process. Source balance continuity is mandatory. Account-statement movements are automatically labeled income for positive values and expense for negative values, preserving recognized reserve transfers (Dinheiro reservado/retirado and Reserva por gastos). These editable cash-flow defaults follow the user-requested sign policy; own-account transfers still need review. Settlement events remain consultation-only and unclassified. Category, merchant, card brand, and installment data are not invented from this sample.

Confirmation rechecks account ownership and duplicates under an account lock, persists a receipt, and writes only selected classified non-duplicate items atomically. Exact repeat uploads return the existing draft/receipt; expired drafts can be replaced. Batch reversal refuses active entries with later edits and permits users to reverse those individual entries before reversing the rest of the batch. These paths have synthetic database tests; concurrent hosted confirmations remain a separate acceptance check.

Confirmation compares the recorded account position before the first source date with the source opening balance. The automatic-opening delivery below supersedes the earlier mismatch-blocking policy: accounts with recorded transactions show a prior-period reconciliation gap, the signed difference and up to five earlier unfinished account imports. Only an account without any transactions, including reversed ones, can propose an opening-position edit. File upload/history retention alone never contributes to recorded balances.

## Additional account-statement exports
The user supplied twelve files in the local modelsMercadoPago Downloads folder. All were inspected without copying private files or extracted financial records into the repository. Seven PDFs (five distinct PDF contents, including two duplicate copies), four CSVs and one XLSX reconciled with the production extraction path. PDF movement counts were 212, 346, 251, 315, 315, 67 and 315; CSV counts were 327, 295, 52 and 140; XLSX had 60 movements. These are examples of the account-statement product, not twelve unrelated report schemas.

| Format | Accepted source contract | Validation |
| --- | --- | --- |
| PDF | Text-based Mercado Pago EXTRATO DE CONTA with initial/final balances and date/description/operation/amount/running balance columns | Existing layout grouping plus chronological dates, exact running/final balance reconciliation; max 100 pages |
| CSV | UTF-8, optional BOM, semicolon delimiter (also quoted comma-delimited equivalents), account summary then movement headers | Standard CSV reader handles quoting, escaped quotes and embedded newlines; strict semantic headers, row fields, running/final balances and credit/debit totals |
| XLSX | Single worksheet with the same account summary and movement columns, using text or native numeric/date cells | Read raw numeric strings before monetary conversion/reference parsing, validate ZIP expansion bounds, reconcile rows and summary totals |

The summary columns are INITIAL_BALANCE, CREDITS, DEBITS and FINAL_BALANCE. The movement columns are RELEASE_DATE, TRANSACTION_TYPE, REFERENCE_ID, TRANSACTION_NET_AMOUNT and PARTIAL_BALANCE. Header order can vary; duplicate, missing or unrelated headers are rejected. Extra nonempty row columns, incomplete rows, invalid dates, descending dates, fractional cents, scientific-notation references and unsafe amounts are rejected. The source column TRANSACTION_TYPE carries the bank description; summary credit/debit values are account direction. Apply the requested editable sign-based cash-flow defaults outside extraction, retaining recognized reserve-transfer exceptions.

PDF, CSV and XLSX share the same sign-based cash-flow default and reserve-transfer exceptions. Labels do not establish verified economic income/expense semantics for loan principal or unidentified own-account transfers: the user can correct the type before confirmation. Unknown merchant/brand/installment/category data remain absent.

The HTTP upload endpoint and multipart fields remain unchanged. File extension and basic content signature are checked; all formats have a 10 MB input limit and a 10,000-movement limit. CSV record size is bounded; XLSX is limited to 256 ZIP entries, 8 MB per expanded entry and 32 MB expanded in total. Extraction workers have a 30-second deadline and 128 MB V8 old-generation limit. XLS/XLSM, other unrecognized Mercado Pago products and card statements, malformed archives and unrecognized layouts fail without creating a batch or ledger records.

read-excel-file uses its supported universal ArrayBuffer entry inside the worker: its Node streaming ZIP entry rejected the user-provided XLSX archive, while the universal reader and ZIP-directory validation process it successfully. csv-parse provides standards-aware CSV decoding. unzipper-esm reads ZIP directory metadata before workbook extraction; no entries are written to disk. Workers and their local MJS dependencies are copied into the API production build.

New account imports use mapper versions mercado-pago/account-pdf/2, mercado-pago/account-csv/2 and mercado-pago/account-xlsx/2 in the existing mapper_version column; previews expose sourceFormat. No migration is needed. Same-file hashing remains byte-based; across formats, source duplicate identity uses account/date/amount/reference/running balance, while weaker manual matches remain candidates. Repeated references with different amounts remain separate rows. Proven source copies are excluded and locked; weaker candidates start excluded but can be reviewed. Source operation IDs are not treated as unique bank identities. Statement input files are discarded after extraction; both financial confirmation and consultation-only retention use the existing reviewed workflows.

## Multiple-file upload
The upload picker accepts multiple PDF/CSV/XLSX files for one selected account. A feature-local queue sends one existing POST /v1/imports request at a time, respecting the API's one-extraction-per-user rule. Each row displays queued/reading/ready/error/not-sent status; one failure does not discard earlier successes or stop later files. Repeated results pointing to the same import ID are labeled. Single-file success still opens its review; multiple-file success leaves a result list with review links after processing.

Stop finishes the active request and skips remaining files. Leaving the upload screen or switching workspace stops subsequent submissions; the active request can still finish server-side. The queue is not persisted or resumed after navigation/reload. Previously processed drafts/retained/confirmed imports remain in server history. The target account is fixed and the selector is disabled while processing. No automatic financial confirmation, history retention or cross-file transaction aggregation is introduced. Existing format limits, hash reuse and confirmation-time duplicate checks remain authoritative. No API or schema change is required.


## Settlement v2 consultation
The Mercado Pago account-money settlement CSV is a separate report product. Detect SOURCE_ID and SETTLEMENT_NET_AMOUNT, require transaction/settlement dates, event type, gross/net amounts and BRL currencies. Use the settlement date's source-local calendar day for the normalized movement, retaining both original timestamps with offsets. Map exact decimal-dot minor units, alphanumeric source IDs, signed/zero net effects and repeated references without inferred classifications. Keep metadata for gross/net/real amounts, fees/taxes, payment method/type, explicit FRANCHISE brand, installment count/ordinal and card last four digits. Unknown optional values stay null; PAYMENT_METHOD is not a brand fallback. Raw METADATA, card prefixes and other unneeded columns are discarded.

This report lacks opening, running and closing balances: expose null, never invented zero balances. The initial consultation-only restriction was superseded by the EDI source-of-truth release below; accepted financial events now use the existing reviewed confirmation workflow. Existing account-statement reconciliation remains mandatory. Consultation rows do not enter ledger, wealth or monthly actuals. Financial JSON backups continue excluding import history.

The 218-record, 69-column user sample passed the compiled worker locally without being persisted or added to Git. It contains malformed embedded quotes in optional source metadata; CSV quote relaxation is scoped to the detected settlement header, while column counts and semantic fields remain validated. Account CSV quoting remains strict. CSV column cap is 96; existing input/row/worker limits still apply. Mapper version is mercado-pago/settlement-csv/1. Valid header-only exports (including blank data rows) are rejected with an explicit no-transactions message rather than an unsupported-header error. No empty import batch or ledger entries are created. The two October 26 local samples contain only the 69-column header; no private records were copied into the repository.

Migration 202610230003_settlement_reports.sql adds report_type, nullable source balances and object-valued report_metadata. Existing rows default to account_statement and retain non-null batch balance constraints. Import rows permit zero-valued consultation events; ledger nonzero rules are unchanged. Apply before code deployment. The user confirmed successful remote application through db:setup, including restricted runtime role configuration.

Field definitions: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/reports/account-money/report-fields

## Automatic duplicate locks
The shared Imports service derives duplicateLocked, duplicateReason (recorded/same_statement/similar/null) and effective selection on every preview/review/confirmation. Date, amount, operation reference and non-null source running balance identify a copy; different balances/references preserve legitimate repeated payments. Within-file identical source identities are locked. Recorded occurrences are counted, not reduced to a globally unique operation ID. Manual or missing-provenance matches using date/amount plus reference or normalized description remain possible matches, initially excluded but reviewable.

One bounded-date account query reads active ledger provenance through the original import item. User edits do not erase bank identity, the current batch is excluded to avoid matching its own receipt, and reversed transactions no longer block reimport. Review PATCH cannot modify locked rows. Confirmation under the existing account lock recalculates effective selection instead of trusting stale client flags; it skips new duplicates and can conclude with zero inserted movements when all are duplicates. No new duplicate-detection schema or unique operation-reference constraint is added. This does not automatically repair preexisting duplicate financial records.

## Existing drafts and period gaps
The current account mapper defaults direction classifications at upload. Existing draft rows still stored as unclassified receive the same effective defaults in previews; explicit income/expense/transfer reviews are preserved. Confirmation writes those effective defaults in one bulk update before creating ledger entries, so the receipt remains consistent after the batch leaves draft state. The existing classifications command remains compatible. Previously stored mapper versions are not rewritten; settlement reports and existing confirmed financial history are not reclassified.

Import previews add canAdjustOpeningPosition, openingDifference and previousImports. Earlier draft/history candidates are scoped to the same owner/workspace/account, exclude settlement/current/expired draft rows and are capped at five; their presence is a navigation aid, not proof that each file is missing financially. Confirmation still rechecks recorded opening balance under the account lock. Missing earlier confirmations are never covered by an automatic opening adjustment or fabricated ledger movement.

## Explicit reprocessing
POST /v1/imports/:id/reprocess reanalyses retained normalized source rows; POST /v1/imports/:id/reprocess-file re-extracts a user-resupplied original. Originals are not stored. Rereading requires the existing SHA-256 file hash and the current review version, checked before bounded extraction and again under account/batch locks. Draft/history only; confirmed/reversed receipts cannot be rewritten. Saved-data processing reconciles account balances; settlement stays consultation-only.

Source occurrences match by date/amount/running balance/reference (description only without a reference), preserving matching item IDs, selections and defined types. Older rows lack manual-vs-automatic provenance, so defined types are conservatively retained by default. Explicit resetClassification reapplies current financial types and clears only incompatible category references. Duplicate checks run again; new candidates default excluded and proven copies stay locked. Replacement rows, mapper version, review version and refreshed draft expiry commit atomically. History status/history_saved_at remain; no ledger insert, reversal or automatic confirmation occurs. No schema migration is introduced.

Cofrinho/reserve cash movements recognized from the Mercado Pago descriptions remain transfers under current mapping, including optional classification reset. They reduce/increase the source account, not expense/income totals. Counterparties and per-cofrinho balances are not fabricated: automatic destination matching and consolidated reserve balances remain separate work.

## Proposed evolution: complementary Mercado Pago sources
Status: initial derived enrichment slice delivered below; remaining financial integration is planned. The user subsequently chose EDI as the authoritative movement source; the delivered confirmation behavior below supersedes the original nonposting plan.

### Findings and decision
Read-only review of the four local settlement models found 218/408/456/655 source rows, covering January through October 2026. Events include SETTLEMENT (both positive and negative), PAYOUTS, CRYPTO_OPERATION, CASHBACK, CREDIT, REFUND and PAYOUTS_CANCEL. Counts include overlapping/repeated source evidence and are not ledger totals. Four CSV account statements contain 814 distinct source movements; 398 share a SOURCE_ID with settlement rows. None of the 399 recognized reserve movements share a reference with those settlement rows. Shared references are matching candidates, not proof of equivalence or coverage completeness.

User decision: settlement/EDI is the primary financial and reconciliation source. Account statements remain usable to create pending entries and to check balances, provide missing reserve movements and enrich evidence. Accept each report independently and show its coverage; absence of a second report must not fabricate completeness. EDI posting uses explicit cash/event rules and durable deduplication, not merely removal of the former guard.

The official report covers available and unavailable money. Local PAYOUTS rows all have IS_RELEASED=false despite negative net amounts. Therefore neither false => ignore nor true => post is a valid blanket rule. SETTLEMENT is not synonymous with income. Credit is not automatically income, refunds are not automatically new revenue, and crypto/reserve transfers are not automatically expenses.

### Scope and responsibilities
- Keep existing institution parsers/mappers, bounded extraction workers and source provenance.
- Add a focused Mercado Pago source-matching service in Imports. Parsers decode; institution mapping interprets event semantics; the service proposes matches and confirmation actions; repositories persist; Ledger remains the only financial writer.
- Preserve approval, release and cash-posting dates separately. Keep availability status, release dates, installment net amount and relevant typed references that are currently discarded. Validate semantic fields and do not retain raw METADATA or card prefixes.
- Separate source operation/event evidence from financial cash entries. A purchase approval, installment release and refund can share an operation reference while representing different events or accounts. Initially support proven one-to-one links only; identify grouped/partial matches for review instead of inventing allocations.
- Keep the existing ledger and account balance formula. Do not build a second ledger or introduce queues, new infrastructure or a generic reconciliation framework.

### Delivery order and gates
| Stage | Delivery | Exit evidence |
| --- | --- | --- |
| 1. Coverage and semantics | Extend retained typed metadata; investigate local event variants, dates, releases, gross/net/fees and duplicate occurrences against account statements; make a supported-event matrix | Every enabled event has documented cash effect, ownership/transfer treatment and representative synthetic cases; unmatched/unknown events remain visible and nonposting |
| 2. Enrich existing cash entries | Preview settlement matches against confirmed statement entries and retained source evidence; persist reviewed links; expose structured details in transaction view | Both upload orders produce the same links; adding settlement changes no balance or planning total; user categories/types/notes remain intact |
| 3. Combined import review | Separate New movements, Enrichments, Already linked and Needs review; source badges and period coverage; preview totals before confirmation | Proven matches need no repetitive selection; ambiguous records cannot create a second financial entry; navigation/queue/reprocessing remain predictable |
| 4. Settlement-only financial integration | Enable only event families with proven cash-posting semantics; distinguish available cash from receivables; report calculated versus reconciled balance | Known starting position required for calculated balances; no invented opening adjustment; statement received later reconciles/enriches instead of reposting; unavailable funds do not inflate available cash |
| 5. Release and recovery | Version contracts/backup, apply additive migration, deploy compatible code, opt-in reprocess and confirm | Existing receipts and totals unchanged; fresh migration/restore, RLS, concurrent confirmation, retries, reversal and hosted smoke tests pass |

Start with stages 1–2. Stage 4 is deliberately conditional: a useful first release can enrich all supported records while keeping unproven cash events consultation-only.

### Matching and financial rules
1. Scope matching by authenticated owner, workspace, institution and account. Preserve file hash idempotency and source occurrence counts. SOURCE_ID alone is never unique.
2. Use event family and explicit related references, exact currency/net effect and documented date relationships. Different approval/posting days can be legitimate; arbitrary date tolerance or amount-only similarity must not auto-merge.
3. Automatically link only an unambiguous supported match. Missing evidence, multiple candidates, fee/net mismatch or one-to-many release patterns become review issues; new unmatched evidence is not automatically proof of a new cash entry.
4. Existing ledger amount/date remain unchanged during enrichment. Metadata conflicts are shown with source provenance; manual edits are never silently overwritten.
5. Post the cash effect once. For the first delivery, retain gross and fees as analytical details without generating a second expense on top of an already netted amount. A future gross-revenue/fee split needs an explicit accounting policy and equal net reconciliation.
6. Link refunds/cancellations to their originals where proven; partial refunds preserve separate event occurrences. Unknown origins remain reviewable. Recognize own-account/reserve transfers without inventing counterpart balances; classify CREDIT and CRYPTO_OPERATION only after their actual meaning is established.
7. New financial confirmation and linking lock the account and relevant evidence, recheck conflicts and commit idempotently. Reprocessing must respect confirmed receipts and manually reviewed links. Reversing one source cannot remove a financial entry supported by another source or leave dangling evidence.

### Persistence, API and regression impact
A small additive schema change is expected: typed settlement availability/release fields and a provenance association between an import item and a canonical ledger entry, with link state and rule version. Exact schema follows stage 1 cardinality findings; do not encode a global unique source_operation_id. Associations need owner/workspace composite FKs, RLS and runtime grants. Repeated source files must not add financial occurrences; distinct partial events must remain distinct.

Imports preview/receipt gains action (create/enrich/already linked/review), match evidence and reconciliation state. Transaction detail exposes linked source summaries. Public changes remain additive where possible. Version JSON export/restore if links or new semantic fields are required to reconstruct financial behavior: current exports deliberately omit operational import history, so define a minimal portable provenance representation before enabling cross-source posting. Do not silently lose deduplication identity after restore.

Regression gates: PDF/CSV/XLSX statements unchanged; both source arrival orders; same-reference different events/amounts; overlapping exports; partial refunds; fees; installments; same operation on different dates; unavailable money; reserves; unknown events; manual edits; archive/category behavior; existing planning totals; stale review; parallel confirmation; reprocessing; reversal; backup round trip; owner/workspace isolation. Use synthetic fixtures only. Existing financial history is not automatically migrated or reclassified.

### Primary references
- [Account-money report scope](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction): includes available and unavailable money.
- [Account-money report usage](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/how-to-use): event types and net impact.
- [Field definitions](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/report-fields): approval/release dates, net amount, release flag and installment fields.
- [Release report](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/introduction): availability and released versus pending funds; an optional future source, not a prerequisite or currently supported parser.

## Delivered first slice: derived settlement enrichment
The initial implementation uses a read model instead of a persisted association table. At this stage no decision creates or modifies financial entries, so deriving matches from retained source evidence avoids stale links, schema changes and reprocessing/reversal repair logic. Persisted reviewed identity remains necessary before settlement-only posting or user-resolved links. No new migration is required for this slice.

- New optional typed metadata: isReleased, releaseTimestamp and installmentNetAmount. Validate release booleans, timestamps, date consistency and exact amounts. Older retained metadata stays readable; use original-file reprocessing to recover previously discarded columns (saved-row reprocessing cannot reconstruct them).
- GET /v1/imports/:id/matches compares the current nonexpired settlement draft/history plus retained reports against active confirmed account-statement provenance. GET /v1/imports/transaction-sources/:transactionId returns matching retained settlement details for an owned active transaction. Draft settlement evidence never appears in transaction details until saved as history.
- Match only identical source reference, source-local approval day and signed net amount, in the same account/workspace. Consult original statement rows even if the user edits the ledger entry; never modify the edited fields. Changed dates, gross/net mismatches and absent references are not guessed.
- Multiple cash candidates, multiple occurrences for the same key within any report, or different metadata/event families for a key block automatic matching across all contributing reports. Exact repeated exports in separate files can describe the same evidence; transaction details show that evidence once. Unknown event families remain unsupported. Reversed ledger rows disappear from matches immediately.
- No source ID uniqueness, balance adjustment, category assignment, fee splitting or additional income/expense is introduced. Transient matches may change when later evidence introduces a conflict; the UI says correspondence rather than a durable reviewed link.
- Imports use a focused settlement view with All/Corresponding/Without automatic link tabs, search/pagination, source metadata, reasons and a deep link to the existing transaction dialog. Saving a report retains its rows and exposes matching details. Subsequent statement confirmation is discovered on the next read; no batch job is needed.
- Financial JSON backup continues excluding consultation reports and these derived details. Restoring financial records does not restore source associations in this slice. Before stage 4, portable provenance and deduplication across restore remain mandatory release gates.

| Observed event family | Interpretation boundary in this release |
| --- | --- |
| SETTLEMENT | Approved operation; positive and negative samples exist. Match evidence, never assume revenue from event name. |
| PAYOUT/PAYOUTS, WITHDRAWAL | Outgoing operation; ownership and destination determine transfer versus expense. |
| PAYOUTS_CANCEL, WITHDRAWAL_CANCEL | Cancellation evidence; no automatic new income. |
| REFUND | Refund evidence, including possible partial events; no automatic new revenue. |
| CASHBACK | Preserve bank event and net value; financial categorization is unchanged. |
| CREDIT | Credit origin requires interpretation; do not assume income or loan automatically. |
| CRYPTO_OPERATION | Asset/cash movement requires asset accounting; do not infer expense. |
| CHARGEBACK, DISPUTE | Supported for exact evidence matching; financial posting remains deferred. |
| Other events | Visible as unsupported; no automatic match or posting. |

Validation: 81 domain/database tests and five focused browser scenarios passed, covering exact matches, repeated references/exports, conflicts, both arrival orders, retention boundary, manual edits, reversal, foreign users/accounts and mobile transaction deep links. All four real settlement models parsed via the compiled worker: 218/408/456/655 records. Against distinct local CSV statement source rows, the conservative matcher classified 346 source records as matched, 70 ambiguous and 1321 unmatched, without persistence. These are source-record classifications, not unique-operation counts or a completeness assertion.

## Balance discrepancy diagnosis
Use `npm run db:diagnose -- --balance=703.31` (decimal-dot BRL amount) or `--account=<uuid>` to inspect only matching Mercado Pago accounts. The local administrative command uses the configured verified Supabase CA and a repeatable-read, read-only transaction with a 15-second query timeout. It prints integer cents, opening position, manual/imported/transfer net effects, latest confirmed statement cutoffs and source/ledger edit or repeated-source evidence. No credentials, names or transaction descriptions are logged and no balances are changed.

Statement comparisons use all active ledger movements through the source's last calendar day. A statement cutoff within the same day, partial selection, later manual edits or omitted prior periods can explain differences; this report is diagnostic evidence, not a command to reset opening positions or remove records. Bank available money, reserves and a historical statement closing balance must be compared for the same cutoff and scope. Reserve balances are still not reconstructed by this application.


## Alelo sample and implementation handoff
Read-only inspection of the user-provided “Consulta de Saldo e Extrato – MeuAlelo.pdf” found a one-page text PDF with 35 movements (four credits, 31 purchases) in reverse date order. It is an Alimentação product example, not evidence of every Alelo product/layout. No operation IDs, running balances, explicit opening position or absolute selected-period boundaries are supplied. Current balance and last-benefit summary must not be parsed as movements. The print date is separate from transaction dates. Private names, CPF, card details and merchant records remain outside the repository.

The Alimentação PDF vertical slice is delivered below: a dedicated Alelo parser/mapper, explicit partial reconciliation capability, separate restricted-benefit accounts and occurrence-aware overlap review. Refeição parsing remains unsupported pending a compatible sample. Do not reuse MP reconciliation by inventing balances or IDs. The execution order and acceptance gates are consolidated in [the completion plan](../domains/personal-finance.md#consolidated-completion-plan-mercado-pago-alelo-and-product-roadmap); do not create a competing roadmap here.

Alelo official product context: [Meu Alelo balance/statement services](https://www.alelo.com.br/content/dam/prerender/alelo/meucartao.html). Product capabilities vary; the local sample is the parser contract for this delivery. No API/login automation is assumed.


## Delivered EDI source of truth and transaction reconciliation
The user clarified that both EDI and account statements must create entries: EDI confirms transaction identity, other methods start pending. Existing account balances and reviewed categories remain intact. Reconciliation of transaction identity is separate from validating an entire available-cash balance or complete import coverage.

- Imports now uses one reconciliation planner for upload, preview, review, confirmation and reprocessing. It emits create/reconcile/recorded/review/ignore with reasons and bounded matching candidates. Indexed lookups avoid per-row scans of all stored evidence. Confirmation rechecks under the existing account lock and idempotency receipt.
- The EDI primary identity combines institution, report type, external reference, source-local approval date, signed net amount, event family, canonical timestamp and installment ordinal. Statement identities include source running balance. Different events sharing a reference are not merged solely by ID/date/amount; uncertain repeats require reviewed linking or explicit new-movement confirmation.
- A matching existing record receives portable evidence and an item-level link; its financial amount, description and category are preserved. Original statement rows are consulted after manual edits. Changed financial date/amount blocks automatic EDI reconciliation and returns the record to pending; category/description edits preserve reconciliation. External source_operation_id is filled when absent; alternate references remain in the evidence rather than overwriting an existing identifier.
- Known outgoing cash can post its signed net effect even if the report release flag is false; positive payment receipts require explicit release; recognized non-payment SETTLEMENT balance events use their observed net account effect (see inflow correction below). SETTLEMENT/PAYOUT(S)/CASHBACK use the requested cash-flow sign policy; CREDIT/CRYPTO_OPERATION/identified withdrawal-cancellation families use transfer classification. Unknown or refund/dispute events require explicit classification or matching existing cash evidence; unavailable positive cash remains excluded. Gross/fees/taxes stay analytical details and are not posted again on top of net cash.
- Pending review rows are unselected by default; they do not silently enter balances. Users can choose an existing compatible account movement or explicitly confirm a distinct new occurrence, subject to availability and type checks. False matches, foreign account IDs and stale review versions are rejected.
- Repeated EDI exports attach support without reposting. Reversal removes proof only when the last confirmed supporting import is removed. A created financial entry supported by another confirmed file cannot be silently reversed by removing its original batch. Confirmed receipts remain immutable; draft/history reprocessing preserves manual link/new-occurrence choices.
- GET/list transaction resources add reconciliationStatus, derived from durable EDI evidence consistent with current date/amount. GET /transactions supports pending/reconciled filtering. UI displays status, external ID and EDI source details; EDI review now offers financial confirmation and action tabs instead of consultation-only instructions. Existing historical enrichment reads remain compatible.

Migration 202610260001_edi_source_of_truth.sql allows settlement confirmation and adds transaction_sources, scoped composite account/transaction foreign keys, forced RLS, restricted grants and import-item link/source-key/review fields. It does not post financial entries or automatically reconcile existing production records. The user confirmed remote application and restricted runtime role setup before code push.

JSON export is version 4. Minimal portable source facts and rule versions are exported per active transaction; restore remaps accounts/transactions, discards operational import-batch references and reconstructs source keys. Versions 1/2/3 remain readable. Raw reports and consultation history remain outside financial backups; these require operational database recovery. Marker/version differences never become alternate financial identities.

Scope: this implements the MP EDI workflow and the latest reconciliation clarification. Alelo, independent benefit/reserve account views, cards and the rest of the consolidated roadmap remain planned; this release does not claim those broader modules are delivered.


## Alelo Alimentação delivery and benefit scope
Migration 202610260002 adds benefit_food/benefit_meal account types with Alelo institution consistency, and benefit_statement batches with null source balances. Existing ledger/RLS/ownership remains unchanged. Account institution/product cannot be changed once movements exist; the manual benefit recorded in MP is not moved or deleted automatically. User confirmed migration application before deployment.

Upload validates account ownership/institution before extraction and revalidates before persistence. A small explicit institution dispatcher selects existing MP extraction or Alelo text PDF extraction through the existing bounded worker. Alelo and MP use a shared exact-money/date reader; bank interpretation stays in separate mappers. No bank-login/API integration, OCR, raw document retention or invented source IDs is introduced.

The Alelo parser accepts the inspected Alimentação layout only. It associates the date/merchant block with exactly one signed amount using coordinates, excludes the current balance/last-benefit/header/footer, sorts descending source rows into chronological order and preserves same-day occurrences. Missing or ambiguous row amounts/dates fail the file. It extracted all 35 real local movements (4 credits, 31 purchases), no external references or balances, without repository copies or financial writes.

Recognized “Seu Benefício Caiu” credits become income; negative purchases become expenses; unrecognized positive events require classification. There is no automatic refund-origin interpretation. Refeição accounts can be created separately but do not accept an Alimentação file. Null opening/running/final source balances remain null. The registered account opening position/date controls ledger creation; the PDF's current balance and relative period are not used to infer a supposedly verified opening. Confirmation labels partial coverage and leaves entries pending reconciliation.

Alelo evidence uses a local internal fingerprint of product account/date/amount/description/occurrence, with an empty external reference explicitly distinguished from bank-issued IDs. Original file hashes handle exact repeats. Other exports with matching fingerprints or same-day/value candidates require review because two legitimate purchases can be identical. Users link compatible occurrences or explicitly create another occurrence; item links/new-occurrence decisions survive draft reprocessing. MP EDI never reconciles Alelo or adjustment entries. Source fingerprints survive JSON v4 export/restore; they do not imply bank reconciliation.

Dashboard available cash excludes benefit/reserve accounts, which appear as separate recorded components. Monthly overview flows still include all accounts and say so. Planning's all/cash/benefits filter affects actuals only; the same saved workspace plan remains visible and unchanged, preserving previous reporting behavior. Accounts provides all/money/benefit/reserve views. No complete reserve position is inferred from transfer recognition.

Release proof: schema rebuilt in tests; 99 domain/database tests passed, covering parser layout/summary exclusion, repeated purchases, upload institution/product ownership, partial confirmation, overlaps, balance resource separation, planning filters, portable evidence and backward-compatible MP source hashes. Remote public Render verification could not run because DNS returned resolution failure; hosted financial confirmation is still a user-reviewed acceptance step.

## Explicit manual current-balance corrections
Migration 202610260003 adds optional balance_adjustment metadata to canonical ledger entries with previousBalance, targetBalance and required reason. The database requires an uncategorized unpaired transfer with no import batch and amount exactly target minus previous; this is a documented balance correction, not consumption or a real counterpart transfer. Existing entries/opening position remain unchanged. User confirmed migration application before deployment.

POST /v1/accounts/:id/balance-adjustments receives targetBalance, expectedBalance, reason and Idempotency-Key. Ledger locks the account, rejects a stale balance, archived account, zero difference, blank reason, unsafe amounts and future-dated active entries; dates the correction today in America/Sao_Paulo; writes through canonical ledger validation. Retries return the original receipt. No adjustment creates source evidence or bank reconciliation; matching candidates exclude corrections. Negative and positive differences affect account balance and remain outside income/expense/planning totals.

Accounts exposes “Corrigir saldo” with a target/reason form, visible difference and explicit confirmation. Transactions show correction context and metadata; corrections cannot be edited through the ordinary form/service, but can be reversed without deleting the original record. JSON v4 preserves correction metadata with arithmetic validation during restore. Current-balance correction does not fill missing history, categorize absent spending or prove full financial coverage; later imports must still be checked against the existing correction.


## Automatic starting position and linked refunds
The user requested removal of manual opening-position setup and misleading import blocks. For an empty account (no transactions, including reversed ones), preview exposes willInitializeOpening when the first source date precedes the registered start or a bank statement supplies a different opening balance. Confirming new movements locks the account and initializes its date/position atomically. Account statements provide the actual source opening balance; EDI/Alelo with null source balances only advance the date backward and preserve the user's registered opening amount. Upload/history-only/reprocessing do not change account positions. Failed confirmation rolls back initialization too.

An established account's opening position is never rewritten. A source opening-balance mismatch remains visible as a nonblocking historical gap, including on the receipt, with the signed difference and prior-file links. New in-range movements may be confirmed; the ledger-derived balance is not thereby declared equal to the bank. Historical dates are accepted in any order; the legacy opening date is no longer a transaction cutoff. No balancing entry is invented; the existing explicit manual correction workflow remains available for a known difference.

Migration 202610260004_linked_refunds.sql adds scoped refund_of_id to transactions/import review. Normal income/expense direction checks remain; opposite-signed income/expense entries require a refund link. Installment ordinal validation is preserved. Application validation enforces same account, original type/category, opposite sign, chronological order, no refund chains and cumulative active refunds no greater than the original net amount, under account/original locks. Original transactions with active refunds and the refund entries cannot be edited; originals cannot be reversed until active refunds are undone.

EDI REFUND/REFUND_SHIPPING/CHARGEBACK families expose eligible original operations for reviewed selection. A released positive purchase refund becomes a positive expense adjustment; a returned receipt becomes negative income. Category is inherited, not inferred from sign. Partial refunds are separate real cash events. Existing cash entries imported from statements can be linked/reclassified through the same explicit original-operation choice, without posting cash twice. The system does not guess refund origins; unavailable new positive receipts stay nonposting. Existing statement cash evidence can establish an observed cash effect even when the EDI release flag is false.

Transaction summaries/planning already aggregate signed net amounts, so refunds reduce original-category income/expense on the refund date rather than rewriting an earlier month's reporting. A refund can make a month's net expense negative; it is still not new income. JSON v4 retains refund_of_id, validates original relationships and aggregate caps, and restores ordinary originals before remapped refund entries. Old backups without links remain accepted.

DISPUTE events and unavailable receipts receive explicit reasons in review. For SETTLEMENT installment records, differing event net and installment net values block standalone posting rather than posting a full purchase as one installment; exact observed cash matching is still possible. This is a safety gate, not complete one-to-many installment/availability accounting. Automated original correlation, complete dispute lifecycle, reserve counterpart balances and release scheduling remain future increments requiring representative source evidence.

The user confirmed remote migration application and restricted runtime setup before dependent deployment. Synthetic tests cover partial/over-limit refunds, refund-first statement reclassification, no duplicate cash, original protection, restore remapping, first-statement automation and preserved nonzero opening for date-only EDI initialization. Historical-date restrictions were subsequently removed for imports, manual entries and backup restoration. Financial effects still require normal user confirmation; no private source records were migrated or reclassified automatically.
## Corrected positive non-payment EDI events

The generic positive IS_RELEASED gate wrongly excluded direct balance entries. Read-only comparison of four local settlement files found 616 positive SETTLEMENT rows with IS_RELEASED=false, no payment method/type, no release timestamp, one installment with no ordinal or installment net, equal gross/net and no fees/taxes. Eight match exact statement reference/date/amount evidence identified as yields, including the source family of the two October 21 screen examples. Counts are raw source rows, not unique transactions or ledger effects. These observations support a narrow source-layout rule, not inferring an income category from a small amount.

isDirectEdiBalanceEvent identifies this non-payment shape. It allows its signed nonzero net effect even when the payment-release flag is false/absent. The mapper does not label a yield category or invent a counterparty. Payment/card/scheduled events, multiple/ordinal installments, mismatched gross/net or fees/taxes do not qualify; previous availability and installment guards remain. Generic unavailable-positive explanation is not shown for recognized direct balance events. Unknown events/refunds retain their own classification/link rules.

No schema/API change: settlement mapper version advances to settlement-csv/3 and portable rule version to edi/3. Source identity excludes mapper/rule version, so already recorded operations remain deduplicated. Existing draft previews apply the corrected policy immediately; original-file reprocessing is only needed to recover metadata previously discarded, not just to activate this rule. Existing confirmed financial receipts are not rewritten automatically. Synthetic tests cover positive false/absent release flags, payment/schedule/installment/fee negatives, account income effect and repeated exports without duplicate postings.


## Historical migration without manual starting-position setup
Account forms now collect name, institution and product only. Legacy opening amounts/dates stay in API/storage/backups for compatibility and are preserved on edits; new forms supply zero and the registration date internally. The first bank statement can still supply the pre-period amount automatically for an empty account. EDI/Alelo without that amount do not invent it.

A legacy opening date no longer blocks imports, manual entries, transfers or backup restore. Established account opening amounts are never replaced by an older source; only the confirmed nonduplicate movements affect totals. Source balance gaps remain nonblocking and visible. History-only storage remains an optional way to retain a report without posting financial effects, not a requirement for old files. No migration or public contract change is needed. The manual opening-position modal was removed; known differences use the auditable current-balance correction.


## Counterparty relations and category automation
Counterparties owns agents, source/account-scoped exact description or store-ID aliases, and category rules scoped by agent/account/income-or-expense type. Imports batch-matches active aliases/rules for preview. Explicit categories take priority; unknown/generic/ambiguous identity stays unclassified by these rules. Source operation IDs remain transaction proof, never party identifiers. Optional STORE_NAME/STORE_ID fields are bounded, retained and displayed; store presence excludes the non-payment yield shape. MP source key identity is unchanged.

Draft learning intent is preserved through reprocessing but creates no agents/rules until financial confirmation. Ledger resolves future categories and owns retroactive transaction writes. CounterpartyRulesWorkflow invokes the ledger write port under the same database transaction/account lock; the counterparty service does not write ledger tables. Table-level relation creation and rule category changes update recognized uncategorized/rule-managed historical entries, preserve explicit manual categories, skip transfers/adjustments/refunds and originals with active refunds, leave money/date/source proof unchanged, and return an affected count. Remembering a category explicitly opts that entry into rule management.

Proved statement/EDI matches can learn each other's specific descriptions and supplied store IDs in either arrival order. Re-observation does not reactivate a removed alias; conflicting active aliases are never reassigned silently. Store IDs are case-sensitive, separate from normalized descriptions. Multiple matching agents suppress automatic recognition; category rules never influence transaction matching or deduplication.

JSON v5 exports/restores the counterparty snapshot and transaction provenance with account/category/agent/rule remapping. Restore validates ownership references, alias uniqueness/kinds and rule scope and does not replay category automation. Migrations 005/006 add RLS-protected metadata/constraints and scoped transaction references; existing financial values are untouched.

User confirmed both migrations and restricted runtime setup before deployment. Verification: 123 domain/database tests, 36 browser scenarios, full verify, generated-contract drift and formatting checks passed. Mobile/desktop layouts were inspected; hosted acceptance remains separate from local mocked-browser verification.


## Confirmation responses and refresh failures
Financial confirmation and subsequent report refresh have separate outcomes. A successful confirmation receipt immediately locks the review controls locally, even when report refresh fails. Reversal remains unavailable until the fresh version is loaded. Cached report data remains visible on refetch errors with an explicit refresh action. On a network/5xx confirmation response, the client reads the batch once and accepts success only if the persisted status is confirmed; it never automatically repeats the POST. A failed status check reports uncertainty. Existing server idempotency and transaction rollback remain authoritative.

Unexpected API failures log only an allowlisted error code and request ID; exception messages, SQL, parameters and credentials are omitted. The reported production EDI issue could not be queried directly because local database DNS returned EAI_AGAIN; these safeguards are verified locally and do not establish the original production cause.


## Human-confirmed identity suggestions (2026-10-27)
Description identity comparison now ignores Portuguese combining accents, punctuation, case and repeated whitespace. Original text, legacy normalized keys, operation source keys and merchant-ID case remain unchanged. A pure Counterparties recognition index supplies batched exact recognition and up to three advisory candidates from active names and account-scoped active descriptions. Full token phrases, anchored first/last-name abbreviations, truncated surnames and one-edit/adjacent-transposition surname variants may suggest a person. Generic words, bare operation numbers, unrelated partial first names and disabled people do not create identities. Cross-payment-method names are suggestions, never exact identities; ambiguous canonical aliases produce no automatic match.

POST /counterparties/suggestions is a scoped read-only lookup for the manual/edit form. Import preview adds counterpartySuggestions separately from counterpartyId/categoryId. New rememberCounterparty intent is independent of rememberCategory, survives original-file/saved-data reprocessing even when financial types are reset, and is persisted in existing classification_intent JSON. It learns only during a successful ledger write/financial confirmation. Invalid writes roll everything back. Forms select suggestions locally before saving; confirmation remains explicit.

POST /counterparties/:id/identifiers explicitly accepts another statement/manual description without requiring a category. The workflow locks the account, writes a conflict-checked alias, and asks Ledger to bind recognized unassigned active income/expense history and apply any existing enabled directional category rules. It never overwrites a different manually assigned identity or manual category, changes money/date/proof, guesses transaction reconciliation, or makes fuzzy matches historical facts. Linked/categorized counts are separate. Explicit category-rule workflows remain available.

Canonical comparison has shared JS semantics and a PostgreSQL expression helper; future single-record lookup and historical CTEs refuse multiple identities. Alias insert/upsert blocks canonical cross-person conflicts; automatic proof observation skips a conflicting alias. Restore uses a separate strict insertion path to preserve previously valid raw aliases even if a new comparison makes them ambiguous. JSON v5 and schema remain unchanged; no migration or bulk rewrite is required. UI terminology is Pessoas e estabelecimentos.


## Audited balance basis (2026-10-30)
Accounts owns the effective stored base, its bank/manual reference and append-only account_balance_history. AccountBalanceBasis is an integration port; Ledger invokes it after financial mutations and Imports after complete confirmation/reversal. Correcting a balance writes the base and audit only, under account lock, optimistic account version/current-balance check and the existing idempotency receipt. Unknown/flagged bases can be confirmed with zero difference. Future active entries prevent a current-balance observation. Profile edits cannot bypass an existing financial/base audit. Transfer accounts are locked in deterministic order and both are rebased after changes.

A statement reference represents the bank balance before its first source movement date. Effective base equals that reference minus active recorded movements before it. A fully represented, unedited confirmed source establishes an unknown base; an older source replaces an existing reference only if the derived base agrees. Partial selections do not establish bank evidence. A conflict preserves the existing amount, records a review flag/reason, and remains nonblocking for real imported movements. A confirmed historical source can be considered explicitly from the review page. Bank reference date is separate from the deprecated registration/opening_date; no date cutoff or mandatory starting setup returns.

A manual reference records the observed current balance and business date in America/Sao_Paulo. Existing transactions are marked known (balance_basis_included); the base is derived from active earlier-date entries plus known same-day entries. New older entries are absorbed into the base so an already observed balance is not counted twice. New manual same-day entries are treated as subsequent movements. Date-only imports on the observation day remain subsequent/uncertain and request another optional check rather than guessing intraday order. Manual audit details retain known same-day IDs so undo can restore an older observation's membership. Source, category and money facts are unchanged. Current manual undo is append-only and idempotent; inactive/superseded/foreign/stale requests are refused.

Migrations 202610300001/002 add scoped basis/audit storage and the ledger snapshot marker. Active legacy correction amounts are folded into the base and original correction rows are retained as inactive, with full conversion details; reversed corrections remain documented. Every account's previous total is preserved. The second migration handles old-API writes in the rolling-deploy window and forbids new active financial correction rows. Runtime audit permissions permit SELECT/INSERT only. No imported financial transaction is fabricated to establish a base.

JSON v6 exports base references, full audit and membership flags. Validation checks audit/account ownership references, money bounds and the current reference/base equation. Restore remaps audit IDs and known transaction IDs, preserves snapshot membership and restores ordinary financial records without replaying automation. Versions 1–5 remain accepted: old correction transactions are converted to base/audit once, not restored as financial rows. No original import files are exported; restored bank references retain their facts without dangling batch links.

The UI offers optional current-balance calibration after a balance-less/partial first import, an explicit source-reference action, account balance history and active-manual undo. Unknown/flagged cash bases are identified as partial/needing review on account cards and the dashboard. A source reference proves its point in time, not complete live banking coverage.
