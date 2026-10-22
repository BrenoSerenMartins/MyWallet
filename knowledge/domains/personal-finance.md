# Personal finance product roadmap

## Purpose and status
Build a complete personal-finance workspace covering daily spending, commitments, credit, investments and recorded net worth. The user requested this roadmap and confirmed separate credit-card and recurring-expense areas. This is a plan; only the existing pilot features below are implemented. Implementation proceeds in small releases with explicit acceptance, rather than scaffolding every future module now.

## Current foundation
The pilot contains private user-owned workspaces, accounts/opening balances, categories, income/expenses, atomic transfers, history/corrections/reversals, Mercado Pago account-statement PDF review and confirmation, monthly summaries, JSON backup/restore, CSV export, Auth and responsive light/dark/system PWA navigation. Hosted acceptance remains separate from code availability; see [overview](../architecture/overview.md).

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
| Imports and reconciliation | Existing Mercado Pago account PDF; explicit source/target and review | Additional bank/card samples, OFX/CSV mapping, classification rules and matching recorded payments |
| Notifications | In-app upcoming/overdue/overspend notices | Opt-in push/email through supported platforms, with scheduled delivery and deduplication |
| Workspaces | Existing private spaces and isolated data | Rename/archive, workspace preferences; later explicit viewer/editor membership and invitations |
| Data and operations | Existing financial export/restore; tested operational backup and recovery | Expanded backup schema per domain, retention/export/deletion controls and security review |

## Navigation and design
Desktop groups are: Overview; Daily finances (Accounts, Transactions); Planning (Recurring commitments, Calendar, Budgets); Credit cards; Wealth (Investments, Assets and debts, Reserve, Goals); Reports; Imports; Settings. Categories belong in their own management screen linked from Settings and entry forms. They are classifications, not containers for cards or recurring bills.

Mobile keeps five primary destinations: Home, Transactions, Cards, Planning and More. More provides Accounts, Wealth, Reports, Imports, spaces and Settings. Introduce destinations only when their screens work; current pilot navigation stays until the corresponding release.

Cards use bank-like visual cards with issuer/name, `brand`, masked last four digits, current statement, available/used limit and closing/due dates. Store neither full card numbers nor security codes. An empty registered card remains visible with a zero bill and zero usage. Screens distinguish recorded, projected, paid, overdue and estimated values through labels as well as color.

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

## Delivery sequence and acceptance
| Release | Scope and dependencies | Acceptance examples |
| --- | --- | --- |
| 0. Reliable hosted pilot | Finish actual hosting, redirects, runtime DB readiness, recovery and real-device checks | Real sign-in/import/reload on desktop/mobile; another user/space cannot read the data; recovery verified |
| 1. Credit overview | Cards, cycle dates, manual single purchases, opening liability, full bill payment; update expense reporting and backup format first | Empty card shows zero; purchase affects liability; payment reduces cash/debt once; percentages use visible denominators; cycle boundary tests |
| 2. Installments and card reconciliation | Release 1; installment schedule, future bills, refunds, imported payment matching; samples for each supported card statement | Installment sum equals purchase; closing-day/short-month cases work; original/full versus monthly amounts never double count; duplicate imported payment prevented |
| 3. Recurring finances | Payable/receivable occurrences, subscriptions, calendar, variable estimates and settlement matching | Repeated generation creates one occurrence; editing future rules preserves paid history; subscription paid by card affects forecasts once |
| 4. Budgets and cash flow | Releases 1–3; category budgets, upcoming commitments, spending mix and forecasts | Cash/spending views reconcile by policy; no-income month handles percentages; paid/planned amounts remain distinct |
| 5. Complete recorded wealth | Assets/debts and manual investment holdings/valuations; expand export/restore | Linked positions are counted once; stale values are labeled; principal/interest differ; recorded net worth reconciles to components |
| 6. Reserve and goals | Release 5 plus essential-spending baseline and allocation rules | One asset cannot be overallocated; goal/reserve amounts do not increase wealth; progress/date/coverage are traceable |
| 7. Analysis and automation | Reliable preceding releases; richer reports, opt-in reminders, additional mappers and classification rules | Metrics explain dates/sources; rules preview changes; notifications deduplicate; unsupported imports fail without creating financial records |
| 8. Collaboration and advanced assets | Separate decision after personal flows stabilize | Explicit memberships/roles/revocation, isolated caches, reviewed cross-space totals and expanded audit/privacy controls |

Each release includes usable mobile/desktop screens in both themes, loading/empty/error/offline states, migrations, RLS/composite ownership constraints, generated contracts, export/restore coverage and focused financial regression checks. Do not estimate calendar dates without knowing development capacity and representative input data.

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
