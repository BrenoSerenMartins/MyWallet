# Statement imports

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

Confirmation also compares the recorded account position before the first source date with the source opening balance. A mismatch blocks financial confirmation, but is presented differently from editing account opening: accounts with recorded transactions show a prior-period reconciliation gap, the signed difference and up to five earlier unfinished account imports. Only an account without any transactions, including reversed ones, can propose an opening-position edit. File upload/history retention alone never contributes to recorded balances.

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

This report lacks opening, running and closing balances: expose null, never invented zero balances. It can only be drafted or retained as consultation history. Service guards reject item classification, financial confirmation and reopening for integration; a database constraint also prevents financial report statuses. Existing account-statement reconciliation remains mandatory. Consultation rows do not enter ledger, wealth or monthly actuals. Financial JSON backups continue excluding import history.

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
Status: initial derived enrichment slice delivered below; remaining financial integration is planned. Existing settlement reports remain nonposting until the acceptance gates below pass.

### Findings and decision
Read-only review of the four local settlement models found 218/408/456/655 source rows, covering January through October 2026. Events include SETTLEMENT (both positive and negative), PAYOUTS, CRYPTO_OPERATION, CASHBACK, CREDIT, REFUND and PAYOUTS_CANCEL. Counts include overlapping/repeated source evidence and are not ledger totals. Four CSV account statements contain 814 distinct source movements; 398 share a SOURCE_ID with settlement rows. None of the 399 recognized reserve movements share a reference with those settlement rows. Shared references are matching candidates, not proof of equivalence or coverage completeness.

Use settlement as the preferred source of structured operation details, and account statements as the preferred evidence of available-account cash movements, running balances and reserve movements. No single globally authoritative report. Accept each report independently and show its coverage; absence of a second report must not fabricate completeness. A future settlement-only financial mode requires validated cash semantics, not merely removal of the current guard.

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
