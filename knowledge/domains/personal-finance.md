# Personal finance product roadmap

## Purpose and status
Build a complete personal-finance workspace covering daily spending, commitments, credit, investments and recorded net worth. The user requested this roadmap and confirmed separate credit-card and recurring-expense areas. This is a roadmap; the current foundation and monthly-planning delivery below distinguish implementation from future features. Implementation proceeds in small releases with explicit acceptance, rather than scaffolding every future module now.

## Current foundation
The implemented pilot also includes monthly planning, retained consultation history and MP EDI posting/reconciliation with portable source evidence (JSON v4); it does not yet include card billing. The pilot contains private user-owned workspaces, accounts/opening balances, categories, income/expenses, atomic transfers, history/corrections/reversals, Mercado Pago account-statement PDF/CSV/XLSX review and confirmation, monthly summaries, JSON backup/restore, CSV export, Auth and responsive light/dark/system PWA navigation. Hosted acceptance remains separate from code availability; see [overview](../architecture/overview.md).

The dashboard currently reports recorded account balances. It must not label that amount as complete net worth. Private spaces do not imply shared membership.

## Product areas and feature backlog
| Area | First useful delivery | Later expansion |
| --- | --- | --- |
| Overview | Period selector, balances, income/expenses, upcoming commitments, card bills and explicit coverage | Customizable widgets, monthly comparison and explanations of changes |
| Accounts and wallet | Existing accounts/history; reconciliation and balance coverage | Cash wallets, archive/reopen, institution directory, reviewed adjustments |
| Transactions | Existing manual entries, transfers and filters; merchant/payee and notes | Split categories, tags, bulk reviewed edits, reimbursements and attachments when retention is justified |
| Categories | Dedicated management, income/expense categories, essential/discretionary reporting | Subcategories and archive-safe reclassification with impact preview |
| Credit cards | Card registration, statement cycles, purchases, bills and full payment | Installments, shared limits/additional cards, refunds, partial payment, interest, card statement imports |
| Recurring commitments | Fixed and estimated variable bills/income, calendar and paid/pending/overdue state | Annual bills, subscriptions, reminders, adjustments and cancellation history |
| Budgets | Monthly category limits and actual/planned comparison | Carryover policy, custom periods and reviewable spending alerts |
| Cash-flow planning | Calendar, payable/receivable lists, projected account balance | Scenarios for income changes, large purchases and planned contributions |
| Investments | Manual holdings, movements, prices/valuation dates and allocation | Income events, fees, corporate actions, supported price providers, documented performance metrics |
| Assets and liabilities | Property/vehicle/other assets, manual valuations, debts and outstanding principal | Financing schedules, depreciation estimates, collateral links and net-worth history |
| Emergency reserve | Essential-expense baseline, months-of-coverage target and eligible asset allocation | Liquidity rules, historical coverage and contribution planning |
| Goals | Target amount/date, progress and allocations of existing funds | Priorities, contribution schedules and scenario projections |
| Reports | Expenses by category, recurring costs, card usage, cash flow and export | Net-worth evolution, portfolio allocation and period comparisons with coverage warnings |
| Imports and reconciliation | Mercado Pago account PDF/CSV/XLSX; explicit source/target and review | Additional bank/card samples, OFX/CSV mapping, classification rules and matching recorded payments |
| Notifications | In-app upcoming/overdue/overspend notices | Opt-in push/email through supported platforms, with scheduled delivery and deduplication |
| Workspaces | Existing private spaces and isolated data | Rename/archive, workspace preferences; later explicit viewer/editor membership and invitations |
| Data and operations | Existing financial export/restore; tested operational backup and recovery | Expanded backup schema per domain, retention/export/deletion controls and security review |

## Navigation and design
Desktop groups are: Overview; Daily finances (Accounts, Transactions); Planning (Recurring commitments, Calendar, Budgets); Credit cards; Wealth (Investments, Assets and debts, Reserve, Goals); Reports; Imports; Settings. Categories belong in their own management screen linked from Settings and entry forms. They are classifications, not containers for cards or recurring bills.

Mobile keeps five primary destinations: Home, Transactions, Cards, Planning and More. More provides Accounts, Wealth, Reports, Imports, spaces and Settings. Introduce destinations only when their screens work; current pilot navigation stays until the corresponding release.

Cards use bank-like visual cards with issuer/name, `brand`, masked last four digits, current statement, available/used limit and closing/due dates. Store neither full card numbers nor security codes. An empty registered card remains visible with a zero bill and zero usage. Screens distinguish recorded, projected, paid, overdue and estimated values through labels as well as color.

## Spreadsheet-informed monthly planning
The user supplied the local G-Base.xlsx workbook as workflow inspiration, not a request to reproduce its layout or automatically import its records. Read-only inspection found one Base worksheet with projected/actual income sources, estimated/actual/difference expense groups, section totals, investment contribution planning and projected/actual monthly remainder. No workbook, private financial amounts or extracted transaction records are stored in the repository.

The user authorized and received the initial Monthly planning screen: category budgets, actual comparisons, notes, contribution intent and version-checked prior-month copying. Income sources currently use income categories; restricted benefits, merchant/source matching, recurring forecasts and full portfolio accounting remain future work. The following table preserves the broader target, rather than asserting every row is implemented. It can deliver value before full card/recurrence/portfolio accounting: users enter a monthly plan, while confirmed account transactions populate the actual comparison. Later modules supply their own projections and settlement links without duplicating actuals.

| Surface | Proposed behavior |
| --- | --- |
| Month header | Month/year selector, explicit draft/active/reviewed status and copy-previous-month action with preview; no transaction copying |
| Summary | Expected/received income, planned/actual consumption, planned/actual investment contributions, remaining commitments and projected monthly result, each with source/coverage labels |
| Income sources | Salary, benefits and additional income as editable sources with expected/received values; distinguish restricted-use benefits from unrestricted cash |
| Spending groups | User-configurable groups and lines inspired by housing, transport, food, insurance, education, personal care, entertainment, taxes, pets and gifts; show budget, actual and remaining/overrun |
| Credit and debt commitments | Dedicated card/debt screens feed the cash-commitment view; link to the relevant statement/payment and do not recategorize every card purchase as a generic card expense |
| Investments and allocations | Plan contributions separately from consumption; later link actual transfers and eligible reserve/goal allocations rather than generating duplicate expenses |
| Month review | Compare plan with classified actuals, inspect overruns/missing classifications, annotate exceptions and prepare the next month |

Rules and acceptance:
- Monthly plan figures do not create financial transactions or change account balances. Actuals come from confirmed canonical records; importing an already matched movement does not increase actuals twice.
- Start with explicit month/category budgets and income-source matching. Recurring commitments later suggest budget amounts with review; one budget and its forecast occurrences are not independent amounts to add together.
- Separate consumption attribution from cash settlement. Card purchases count by category in spending; paying a bill is a cash/debt settlement. A cash forecast must not count both purchases/installments and their bill payment as separate outflows.
- Planned contributions reduce cash available for use when paid from tracked cash; transfers into investments do not reduce net worth or become consumption. A mere allocation of existing funds is not another cash outflow.
- A consumption-period result is recognized period income minus consumption attributed to that period. Available/projected cash instead starts from recorded opening/current cash and counts actual cash settlements plus remaining expected inflows/outflows once, including paid contributions and debt principal. It does not subtract a consumption aggregate and then subtract its card settlement again. Each summary states its reporting basis; a period result is not an account balance.
- Expense budget difference is planned minus actual; positive means remaining budget, negative means overrun. Income difference is actual minus planned. Do not use one unlabeled difference direction for both.
- Preserve the distinction between not entered, an explicit zero and incomplete actual history. Unknown/unclassified activity is visible; blank income or a zero baseline never yields a fabricated percentage.
- Copying a prior month creates an independent plan; settled history and older plans remain unchanged. Monthly boundaries use the selected workspace timezone and date-only financial dates.
- Entry categories may stay flat initially, with visual grouping added only as needed. Names and groups are customizable per workspace; workbook-specific labels and placeholder rows are not hardcoded as required categories.
- Verify a synthetic month with multiple income sources, zero-budget spending, overspending, a contribution transfer, an imported paid bill and a prior cash balance. Totals must reconcile under the chosen spending/cash policy and remain isolated by workspace.

## Credit cards: release contract
- A card is a credit instrument with an issuer, currency, limit and explicit billing-cycle rules. Creating it does not create an expense. A credit limit is not an asset or income.
- Keep purchase date, monthly expense attribution, statement assignment and payment date explicit. Date-only values use calendar dates. Persist actual statement closing/due dates; short months, weekends and issuer exceptions need reviewable overrides.
- Start with manual purchases and full bill settlement. A posted purchase creates a liability without reducing the checking-account balance. Its statement payment reduces cash and that liability; it is not another consumption expense.
- Before extending the existing ledger, define one canonical reference between a card purchase and its reporting entries. Never persist independent totals in both modules that can drift. Cash-flow reports use settlement dates; spending reports use explicitly labeled purchase/statement attribution.
- For installments, the complete outstanding purchase contributes to liabilities/committed credit. Allocate exact minor-unit installments, preserve the remainder deterministically, and distinguish issued versus future statements. Monthly statement spending counts the installment once; purchase-date reports must be separately labeled and never summed with statement-attributed totals.
- Limit utilization = outstanding committed credit / recorded limit. Monthly credit share = card-attributed spending / total consumption spending in the period. Income commitment = bills due in the month / configured monthly income baseline. Show each denominator and period. Undefined or zero denominators display unavailable, not a misleading 0%.
- Pending authorizations, refunds, partial payments and shared limits alter available-credit rules. First release labels its computed coverage and excludes unsupported cases rather than claiming issuer-exact availability.
- Refunds and cancellations reference original purchases and settled/unsettled installments. Partial payment explicitly leaves a debt; interest and fees are separate expenses. Do not guess rates or automatically refinance balances.
- Existing card opening debt is a dated liability position, not new monthly consumption. Card payments imported from a checking statement must match the bill settlement through review instead of creating duplicate expenses.

## Recurring commitments and categorization
A recurring template defines frequency, date bounds, due-day policy, amount type (fixed/estimated), category and payment source. It creates distinct payable/receivable occurrences with planned, paid, overdue or canceled state. Generation is idempotent by template and occurrence; editing a template offers future-only versus explicitly selected pending occurrences, never rewrites settled history.

A planned occurrence is not a posted transaction. Payment links to the actual ledger/card entry and removes it from remaining forecasts. Reconcile imported payments against occurrences to prevent duplication. Card-based subscriptions create one purchase occurrence and its associated statement liability; forecasts must not add both the subscription and its complete bill to cash outflow.

Fixed/variable describes an expense commitment; category describes its purpose. An essential/discretionary label serves reserve/budget analysis independently. A variable recurring utility bill can have an estimate before its actual amount arrives. Income commitments use the same occurrence discipline without assuming unpaid income is available cash.

## Wealth, portfolio and planning rules
- Net worth = recorded assets minus outstanding liabilities at an explicit as-of date. Display data completeness and valuation freshness. Distinguish current liquid cash, unallocated cash, planned cash and net worth.
- Each tracked asset has one valuation source. An investment linked to a financial account or custodian contributes once. Consolidation must not add the account's full portfolio valuation and its individual positions again.
- Contributions and redemptions between tracked cash and investments are transfers. Fees, income events and market-value changes have distinct meanings. Do not treat price appreciation as salary or spendable cash before realization.
- Begin with manually entered quantities, cost and valuation events, precise decimal quantity/price arithmetic and integer currency amounts. Only add automatic quotes behind a dedicated provider when instruments, terms, update frequency and availability are defined.
- Portfolio returns need a separately reviewed metric with treatment of cash flows, realized/unrealized gains, fees, tax and reference periods. Manual valuation alone does not establish a reliable return history. No automatic trading, tax filing or investment recommendations are included.
- Asset valuation is separate from cash flow. Debt principal repayments reduce cash and liabilities; interest/fees are expenses. Existing debts require opening positions and an explicit schedule versus actual payment distinction.
- Reserve and goal allocations reference existing eligible assets and never increase wealth. Available-to-allocate amounts cannot be exceeded across goals/reserve. The UI must state whether allocations are earmarks or real transfers.
- Reserve coverage uses a visible essential monthly expense baseline, initially manually configured and later suggested from reviewed history. Future expense estimates, liquidity and restrictions are explicit.
- A projected balance is current recorded cash plus remaining dated expected inflows minus remaining dated expected outflows. Settled entries and internal transfers must not be added twice. Scenarios remain separate from actual records.
- BRL remains the initial currency. Multi-currency portfolios require dated exchange-rate sources, conversion/rounding policies and missing-rate handling before consolidated totals are shown.

## Consolidated completion plan: Mercado Pago, Alelo and product roadmap
Status: planning requested on 2026-10-26. The MP source-provenance and EDI creation/reconciliation increment was subsequently implemented; Alelo Alimentação import, benefit/cash separation and documented manual balance corrections are now implemented; later product areas remain planned. Existing ledger, grouping, planning comparisons, Outros coverage, MP statement imports, retained history, EDI financial confirmation, durable source identity, pending/reconciled transaction status and JSON v4 source recovery remain delivered (main 8621717). Production/device acceptance is tracked independently. No schema or financial records change through this plan.

### Scope and delivery order
Finish import accuracy and benefit separation before expanding the financial domains. Alelo may be delivered before MP settlement-only posting because its concrete sample enables a smaller useful workflow; it still depends on source provenance and partial-reconciliation support. The later card/wealth releases complete the broader requested product scope, rather than blocking delivery of Alelo.

| Priority / release | Work | Dependencies | Completion evidence |
| --- | --- | --- | --- |
| P0. Correct financial scope | Separate available cash, restricted benefits, reserves and future receivables; dated calculated/reconciled/partial balances; add account filters to monthly actuals and explain included totals | Existing accounts/ledger/planning | An Alelo balance never appears as spendable Mercado Pago cash; benefit inclusion is explicit; previous totals do not change silently |
| P1. Source identity foundation delivered; hardening remains | Delivered durable evidence, external IDs, reviewed links, source keys and JSON v4; finish classification provenance, concurrency acceptance, bounded diagnostics and managed unlink/relink UX | Migration 202610260001 applied; code main 8621717 | Real deployment and overlap/backfill acceptance; corrections and source decisions remain explainable without duplicate cash effects |
| P2. Alelo Alimentação/Refeição PDF import | Separate Alelo parser/mapper, benefit accounts and capability-aware review; credits/purchases and explicitly supported reversals; sequential batch upload | P0 and P1 primitives | The supplied 35-row text PDF parses into exact amounts/dates; duplicate headers/summary are excluded; no IDs/balances are fabricated; overlaps and manual entries are reviewed correctly |
| P3. Mercado Pago special events and coverage | Core EDI posting/linking delivered; complete partial refunds, disputes, installment release allocations, dated availability and ambiguous-event corrections | P1, representative MP evidence and event matrix | Statements and settlement in either order create one cash effect; approval/unavailable money never becomes available cash accidentally; unsupported events remain visible and nonposting |
| P4. Cofrinhos and reserve accounts | Track parent bank account and individual reserve accounts, explicit opening/as-of values, paired transfer matching and identified yields | P1, actual reserve evidence and P3 transfer rules | Moving cash changes its location, not spending or consolidated ownership; independently imported counterparts do not create four transfer legs; missing reserve history stays labeled |
| P5. Credit cards | Issuer, brand, masked last four, limit, cycles, opening debt, purchases, full bill payment; then installments, refunds and imported payment matching | Canonical consumption versus cash reporting contract and backup extension | Empty card remains visible at zero; purchase creates liability; payment reduces cash/debt once; installments sum exactly; utilization/share metrics state period and denominator |
| P6. Fixed costs and recurring finances | Separate payable/receivable calendar, subscriptions, fixed/estimated amounts, paid/pending/overdue states and future-only edits | P5 payment boundaries and idempotent occurrence identity | Repeated generation creates one occurrence; settling an imported payment removes forecast once; paid history is preserved |
| P7. Planning and reports completion | Feed commitments/cards into planned cash flow; essential/fixed/variable spending views, account/benefit filters, plan/actual comparisons and explained trends | P0, P5 and P6 | Consumption, cash settlement and outstanding commitments are distinct; card purchase and bill payment never count as two expenses; zero/missing denominators stay unavailable |
| P8. Investments, assets and debts | Manual positions, quantities/cost/valuations, contributions/redemptions, income/fees, properties/vehicles/debt principal and recorded wealth history | Exact quantities/valuation policy and domain backup support | Cash/holdings counted once; contribution is transfer; principal differs from interest; values show date/source and incomplete coverage |
| P9. Emergency reserve and goals | Essential-spending baseline, eligible/liquid assets, months of coverage, targets and contribution progress | P8 and allocation rules | Existing funds allocated to goals do not create assets; one asset cannot be overallocated; restricted benefits excluded from eligible emergency liquidity |
| P10. Automation and operational acceptance | Previewable categorization rules, in-app notices, later opt-in push/email; supported institution formats; actual deployment, recovery and device acceptance for every release | Reliable preceding financial flows; scheduler/delivery choice only when required | Rules preserve manual edits; notices deduplicate; hosted sign-in/import/reload and recovery work; no paid service or external sending is assumed |
| P11. Optional collaboration | Private workspace lifecycle first; later explicit viewer/editor memberships, invitations and revocation | Stable personal workflows and a separate collaboration design | Membership/RLS/cache isolation tested; no accidental access from shared account identifiers |

P2 refers to Alelo Alimentação and Refeição as distinct products/balances; the provided sample validates Alimentação only. Do not advertise Refeição layout coverage until it is represented by a compatible sample. Scope of this plan includes the broader backlog, but implementation proceeds release by release and does not create empty future screens.

### Remaining execution queue after main 8621717
This queue is the next-work view of the release table above, not an additional roadmap. Do not repeat already delivered source identity work.

| Order | Remaining increment | Exit criteria and boundary |
| --- | --- | --- |
| 1 | Hosted MP acceptance and reconciliation correction | Verify deployed revision/readiness; preview the user's old EDI against existing entries, explain zero matches, test both upload orders on synthetic hosted records and inspect dated available-cash totals. Real financial confirmation/backfill remains reviewed. Distinguish source identity reconciliation from complete account balance reconciliation. |
| 2 | Delivered: separate cash, Alelo benefits and reserve views (P0) | Explicit account kind/product and dated balance scope; available cash excludes restricted benefits; totals and planning disclose inclusion policy. Add migrations/contracts/backup compatibility before benefit records. Correct the legacy manual benefit in MP only through reviewed amount/date/account changes. |
| 3 | Delivered: Alelo Alimentação PDF vertical delivery (P2) | Parse the existing one-page/35-row sample; reverse-order dates, credits, purchases and merchant details; no summary duplication or invented IDs/opening balances. Add benefit-aware upload/review/history/confirmation and overlap decisions. Va/VR accounts stay separate; Refeição support needs a compatible sample. Generic pending status must state which evidence can reconcile Alelo: MP EDI must never reconcile another institution. |
| 4 | MP special-event hardening (remaining P1/P3) | Partial refund/dispute originals, one-to-many installment releases, availability transitions, explicit rule/manual provenance, persistent conflict explanations and managed unlink/relink. Expose retained net/gross/fee policy and return edited amount/date to review. Exercise parallel confirmation and source correction, not just sequential retries. |
| 5 | Actual cofrinho balances (P4) | Explicit reserve opening/as-of position and evidence, account links, paired transfers/yield, no duplicated counterpart posting. Current transfer recognition alone cannot establish reserve balance. Requires appropriate source examples or a reviewed dated position. |
| 6 | Cards, then recurring commitments and cash-flow planning (P5–P7) | First manual card/cycle/opening debt/full bill payment, then exact installments/refunds/imported payment matching. Next idempotent recurring occurrences/calendar. Finally feed consumption and cash forecasts once, with explicit reporting basis. |
| 7 | Investments, assets/debts, reserve targets and goals (P8–P9) | Manual valuation/movement foundation before quotes/performance; record ownership once, dated values, principal/interest distinction and non-overlapping allocations. |
| 8 | Analysis, automation and optional collaboration (P10–P11) | Expand reports and previewable categorization only on reliable domain records; then in-app/opt-in scheduled notifications. Sharing needs explicit membership/RLS/revocation design after personal workflows stabilize. |

Release 1 and the P0–P2 Alelo vertical slice are the immediate priority. Do not hold Alelo until every MP exceptional event is implemented. Every increment must end with an actual usable workflow; expose only working destinations and keep existing themes/navigation conventions. Production financial history is not rewritten to make new totals look reconciled.

For each increment: summarize affected modules/rules/integrations/schema/API/regressions before edits; create only additive migrations, verify RLS and backup round trip; run targeted financial and browser scenarios plus repository checks; apply database changes before dependent deploy; document actual hosted acceptance separately. Use synthetic fixtures, never private sample data in Git. No new provider, paid service, OCR or scheduled infrastructure is required for the first three increments.

### P0: amounts and existing history
- Financial-account classification distinguishes cash, restricted benefits and reserve holdings without treating Alelo as a credit instrument. Retain institution='alelo'; the network brand is separate and is populated only from evidence. Do not infer a card network solely from provider name.
- Available cash excludes restricted benefits and reserves. Benefit cards have their own credit/debit balances. Consolidated recorded resources may include them only as a separately identified component; emergency liquidity excludes restricted benefits.
- Monthly planning defaults must preserve the existing calculation basis until the user explicitly chooses benefit inclusion. Explain credits as benefit income and purchases as consumption in that chosen view; benefit balance, income and expenses are never added together as assets.
- Existing manual benefit credit currently recorded in an MP account requires reviewed correction: choose whether it was a mistaken posting or a genuine transfer, reconcile the exact amount/date, preview account/planning effects, then reverse/recreate or link through the normal workflow. Never silently move or delete it. The Alelo sample credit amount differs from the manually described amount; do not merge on a guess.

### P1–P3: source, matching and confirmation contract
- Add an owned, workspace-scoped source-event representation and explicit link/decision state to the canonical financial entry. Preserve normalized source facts, institution/report type, account/product, occurrence identity and mapper/rule version. One source identifier alone is not a unique event. Exact schema follows a cardinality review of refunds and installments; no generic event bus or parallel ledger.
- Retain the current derived MP enrichment during rollout. New reviewed matches are durable; old confirmed receipts remain immutable. Backfill only proven associations, preview ambiguous cases and retain manual categories/notes/type overrides.
- Review actions are create, enrich/link, already recorded, exclude and needs review. Automatically resolve proven duplicates; unknown or ambiguous rows are not silently selected for financial posting. Show source evidence and reasons beside the action.
- For MP, separate original approval, actual cash posting and availability dates. Define posting rules per event family. CREDIT, CRYPTO_OPERATION and unidentified own transfers cannot fall through to sign-only income/expense. Retain unmatched events rather than falsely treating the import as complete.
- Keep net cash effects as the initial posting basis. Gross, fees and taxes enrich analytical detail; they are not another cash expense on top of a netted amount. A later gross/fee accounting view must reconcile to the same net.
- Refunds/cancellations reference original events where proven, including partial/multiple occurrences. One-to-many installment releases require explicit allocation semantics rather than repeated full-purchase postings.
- Lock account/source decisions and recheck ownership, review version, duplicates and idempotency at confirmation. Reprocessing does not erase reviewed decisions or rewrite confirmed cash effects. Removing one evidence source does not reverse an entry still supported by another; financial reversal is a separate explicit action.
- Before enabling standalone financial posting, extend backup with the minimal portable identity required for cross-format deduplication after restore. Do not export raw private documents. Retain compatibility with current JSON versions; do not enable posting before migration/restore tests pass.

### P2: Alelo acceptance and recovery policy
The local PDF contains text, one page, a masked card identifier, a displayed current balance, a last-benefit summary and 35 transaction rows in reverse chronological order (four positive benefit credits, 31 purchases), dated 2026-06-29 through 2026-10-12. It has no operation reference, explicit opening position or per-row running balance. The relative label “Últimos 4 meses” does not establish exact inclusive boundaries or completeness. Header “Último benefício” repeats information represented in the movements and must never create a second credit. Footer print date is not a transaction date.

- Parse institution/product, chronological transactions, full merchant text, exact BRL amounts and explicit credit/purchase descriptions. Exclude holder name, CPF, masked card blocks, summary rows and print footer from the ledger. Retain at most a justified masked last-four product reference; never store full card identifiers.
- Each independently balanced benefit gets its own account. Recognized employer credits are benefit income; purchases are expenses. Explicit reversals are linked as corrections of the original financial meaning. Unknown positive/negative events require review; sign alone cannot distinguish a refund from a new benefit credit.
- Reuse bounded text-PDF extraction. Do not add OCR, browser-login automation, credential storage or an Alelo API assumption. Other Alelo layouts/formats require additional samples.
- Sort descending source dates into chronological posting order while retaining original row occurrence. Same merchant/date/amount can be two genuine purchases. File hashes prove repeat files; overlapping files require occurrence-aware evidence and user review where no stable identity exists. No fabricated operation IDs or running balances.
- Show reconciliation capability per report. A snapshot balance is not automatically a period-end balance; do not force MP-style reconciliation on this PDF. Offer a user-confirmed dated opening position or retain partial history with an explicit unresolved balance warning. An algebraically inferred opening is only a proposal if snapshot time and complete interval are validated, never silently accepted.
- Import the supplied history into the Alelo account through review. Preserve the preexisting MP manual benefit record until its correction is explicitly reviewed; source credit amount/date mismatch blocks automatic linkage. Financial totals before/after correction must be visible.
- Test reverse chronology, repeated same-day purchases, multiline merchants, credit summary duplication, refunds, decimal/comma parsing, invalid dates, partial periods, repeat/overlap files and isolated VA/VR ownership. Acceptance means faithful extraction and honest balance coverage, not a fabricated reconciliation success.

### Implementation boundaries and UX
Keep dedicated institution parsers/mappers under Imports. Extract through an institution dispatcher using the owned account context validated before worker execution and revalidated before persistence; avoid the current MP-only upload guard becoming an ever-growing conditional. Extend the normalized report contract with explicit balance/reconciliation capability where needed, without creating a provider plugin framework. Ledger owns financial writes; repositories own persistence; handlers receive/validate/dispatch/respond.

Accounts and Home use expandable sections/tabs for available cash, benefits and reserves, with dates and coverage. Imports keeps institution/account/product visible, plus summary counts and progressive transaction detail; expose only relevant actions. Preserve batch upload, themes, search/pagination, keyboard navigation and mobile readability. No redundant explanatory banners or inactive navigation entries.

### Release procedure and final checks
Each release includes additive SQL migrations where required, minimal runtime grants/RLS/composite FKs, generated OpenAPI/frontend types, backup compatibility, documentation and focused tests. Apply the migration before code that depends on it; verify production readiness and browser flows before marking hosted acceptance complete. Do not change old migrations or silently reclassify production history.

Required regression matrix: both arrival orders, repeated/overlapping files, manual versus imported duplicates, stale versions, concurrent confirmations, source-only removal versus financial reversal, historical partial intervals, edited records, zero/unentered targets, date boundaries, source amount precision, cross-user/workspace denial, fresh schema and backup round trip. Run mobile/desktop in both themes, empty/error/loading/offline states and an actual device smoke test. Track logical source coverage separately from the count of parsed rows.

Remaining input gates are concrete: a compatible Refeição sample if needed; explicit reserve statement/snapshot evidence for individual cofrinhos; actual card issuers/cycles and card-statement samples; a selected reminder delivery mechanism only for later automation. These do not block starting P0–P2. No calendar estimate is committed without development capacity and additional sample coverage.

## Architecture and implementation boundaries
Retain the React/Nest/PostgreSQL modular monolith. Add feature modules as their releases start: `cards`, `recurring`, `budgets`, `investments`, `wealth`, `goals` and, only with scheduled delivery, `notifications`. Reserve can initially be a focused goal type with a coverage policy if that avoids duplicate allocation logic; separate it only when responsibilities require it.

Ledger retains canonical cash movements. Cards own billing/purchase schedules; recurring owns templates/occurrences; wealth owns valuations/liabilities; dashboard/reports compose read projections. Services communicate through narrow integration contracts wired in composition. Controllers/UI never calculate authoritative balances or financial rules. Scheduling must invoke the same idempotent use cases as manual generation; do not introduce queues or microservices before a real operational need.

New entities remain scoped by verified user and workspace, with composite references protecting cross-space relationships. Index actual period/list lookups; use version-checked edits, atomic settlement, idempotency and reviewed reversals. Each release extends its backup schema with explicit compatibility handling before users create records in its new domain. Keep existing migrations immutable and add tested migrations; no schema or public endpoint is introduced by this roadmap.

## Risks and decisions before implementation
| Risk or open decision | Required resolution |
| --- | --- |
| Cash ledger currently represents account movements | Design card expense projections and settlement references without changing existing account balances or legacy reports silently |
| Issuers differ in installment/closing/limit rules | Validate actual card examples; allow explicit statement assignment/date corrections |
| Meaning of monthly percentages | Ship separate limit, spending-share and income-commitment metrics with period and zero-denominator behavior |
| Legacy imported bill payments categorized as expenses | Preview/link/reclassify with history preserved; never rewrite personal history automatically |
| Recurrence timing/timezone/month end | Choose workspace timezone, calendar policy, occurrence identity and edit semantics before generation |
| Portfolio and debt valuations | Record dates/source, avoid overlapping asset/account representations, keep estimates labeled |
| Missed scheduled jobs and cold starts | Reconcile missed occurrences idempotently; only add dependable scheduler/reminder infrastructure when required |
| Expanded sensitive data and backups | Limit retained data, version exports/restores, verify recovery and grants for each added table |
| Large navigation and implementation scope | Ship one coherent vertical release at a time and expose only functional destinations |

## External scope
Open Finance/bank connections, native notification capture, native packaging, automated trading and tax filing require separate feasibility and scope. Additional bank/card import formats require user-provided representative samples, institution-specific mappers and reconciliation tests. No provider, paid infrastructure or external financial integration is selected by this roadmap.

## Historical statement consultation
Statements predating the account opening may be uploaded and retained in history without entering the ledger. They are searchable within an import batch, survive draft cleanup and never affect cash balances, expense reports or monthly actuals. Integrating later requires reopening the review and reconciling the account opening/date, classification and duplicates. Empty account opening positions may be explicitly revised; accounts with movements retain the existing protection. Raw PDFs are not saved. Financial JSON backups include monthly plans but not import history; operational backups cover retained consultation data.

## Cofrinhos and account reserves
Moving owned cash into a bank cofrinho reduces spendable account cash but is an internal transfer, not consumption; withdrawal reverses that direction and yield is a separate income event when explicitly identified. Consolidated owned wealth must count the account and tracked reserve once each. The current Mercado Pago mapper recognizes reserve movements as unmatched transfers; it does not automatically create or value individual cofrinhos. Real paired destination matching must avoid duplicating an independently imported reserve movement and requires explicit source evidence.

## Unassigned actuals in monthly planning
All confirmed typed income/expense flows contribute to monthly actual totals regardless of category. Represent unassigned amounts as a virtual Outros line per type, not a persistent category assignment; assigning a category later moves that amount out of Outros without changing aggregate totals. Planned amounts remain the user's targets, distinct from actuals; lack of a target does not imply a zero budget. Transfers/reversals stay excluded and unknown financial types remain visible as unresolved.

Latest user decision and delivery: EDI is the MP source of truth for reconciliation, not merely a detail enrichment source. Statement/manual entries can still post and remain pending until matched by EDI. Portable evidence, EDI posting/review and reconciliation filters are implemented; availability/unknown-event cases remain reviewable. Refer to statement-imports.md for exact delivered semantics rather than treating all P0–P11 areas as complete.

Delivered next increment: Alelo Alimentação text-PDF import with partial coverage and occurrence-aware overlap review; benefit_food/benefit_meal account types; separated available cash/benefit/reserve dashboard components; planning actual account-scope filter; documented idempotent manual current-balance correction and reversal. The real 35-row Alimentação sample parsed locally. User confirmed migrations 202610260002/003. Refeição parsing, individually reconstructed cofrinhos, MP special events and broader card/wealth releases remain pending. Hosted Render checks remain unverified due to DNS restrictions.

Next increment delivered: automatic first-source account initialization (bank opening balance when present, date-only with preserved opening amount otherwise), nonblocking historical-balance gap warnings, reviewed linked partial refunds/chargebacks, existing-cash refund reclassification and portable original references. Complete dispute/release lifecycle, automatic original-event correlation and one-to-many installment allocation remain pending; installment net mismatches are explicitly gated for review. No historical opening or user transaction is rewritten without its reviewed workflow.

## Counterparty automation increment
Delivered scope: agents and source/account aliases (description and supplied MP store IDs), explicit category learning during transaction editing/import review, agent/rule management, retroactive uncategorized/rule-managed category application, proved statement/EDI alias enrichment in both arrival orders, and portable JSON v5 relations. Unknown counterparties are not guessed. Broader tags/goals/recurring classification actions remain later increments; no generic rules engine is introduced.

## Consumer statements without starting setup (2026-10-27)
Current policy supersedes the EDI source-of-truth plan: account/benefit statements are the user-facing import source. No new EDI ingestion or posting. Date and initial amount are not required to create accounts or import old transactions, and confirmation no longer sets them from source files. Existing balances retain compatibility baselines; source balances are optional checking facts. Partial history may require an explicit current-balance correction. Transaction evidence from a statement can be confirmed independently of full account-balance coverage.

## Identity recognition and explicit acceptance
A person/establishment can have multiple account/source descriptions across payment methods. Typography-normalized confirmed aliases identify future and historical movements; name, abbreviation and minor spelling similarities only suggest a choice. User acceptance is saved with the transaction/import confirmation or via the identity-only description form. Identity does not require a category, and category rules remain directional by account/type. Generic/ambiguous/disabled identities do not auto-bind. Legacy aliases and manual monetary/category choices remain preserved; no operation ID, amount or date becomes a person's identity.

## Audited base policy (2026-10-30)
Manual corrections change the balance base, not financial movements. A reference can come from a complete bank statement or an optional observed current balance after import. Older history triggers a base recalculation instead of adding already compensated money again; contradictory or temporally ambiguous evidence is flagged. Corrections and undo remain auditable and portable. Legacy corrections are converted without changing the total, and their original records remain. No starting fields are required in normal account setup.
