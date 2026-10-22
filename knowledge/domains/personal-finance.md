# Personal finance

## Purpose
Provide a consolidated view of personal finances in a responsive PWA, with manual entry and statement imports.

## Users and ownership
Launch for the owner's personal use, while supporting separate user accounts when the application is offered to others. Financial data must have explicit ownership, with access isolation enforced by the backend or database when hosted. Separate accounts do not imply shared financial records; household collaboration and invitations remain outside the confirmed scope.

## Requested capabilities
- Home: total net worth, financial summary, and shortcuts to each feature.
- Income and expenses: centralized registration and history.
- Investments: holdings and portfolio overview.
- Wealth: consolidated assets and liabilities.
- Emergency reserve: target and progress tracking.
- Goals: target amounts and progress tracking.
- Manual statement uploads.
- Multiple financial institutions; Mercado Pago is the primary institution, confirmed by the provided PDF sample. Prioritize this statement layout for the first importer.
- Each bank must have its own mapper into a shared semantic financial model, with English terminology including card `brand` and `installments`. See [Statement imports](../architecture/statement-imports.md).

## Proposed supporting capabilities
- Accounts and opening balances; categories and transaction filters.
- Monthly overview of income, expenses, and cash flow.
- Transfers between owned accounts.
- Credit cards, billing periods, and installment purchases.
- Recurring entries, due dates, and paid/pending status.
- Import preview, validation, duplicate candidates, and import batch reversal.
- Category budgets, simple reports, and data export/backup.

## Proposed release phases
1. Financial foundation: accounts, opening balances, categories, income, expenses, transfers, transaction history, one statement format, import review, and a home summary of tracked balances. Include data export and a defined backup/restore strategy.
2. Planning and complete wealth overview: manual assets, liabilities, investment positions and valuations, emergency reserve, goals, and the consolidated net-worth dashboard.
3. Daily management and analysis: credit cards and installments, recurring entries, category budgets, richer reports, and additional import formats.

Phases are a proposal, not an approved implementation commitment. Move credit cards into phase 1 if they are essential to the user's initial workflow. Do not label the phase-1 account balance summary as complete net worth before assets and liabilities are covered.

## Business rules
- Net worth equals recorded assets minus outstanding liabilities. Display valuation dates and distinguish partial coverage from a complete picture.
- An investment linked to an account contributes to wealth once. Reserve and goal allocations reference existing money; they do not create additional assets.
- Transfers between owned accounts are neither income nor expenses. Investment contributions are transfers when both sides are tracked; fees are separate expenses.
- Separate actual transactions from planned entries. Show the active reporting period explicitly.
- Treat opening balances as starting positions, not earned income.
- Imported transactions require review before confirmation. Flag duplicate candidates against existing entries and within the batch; allow legitimate identical transactions.
- Reimporting overlapping statements must not silently duplicate entries. Record import provenance and make reversal affect only entries owned by that import batch.
- A future card purchase records an expense and liability; paying its bill settles the liability without recording the expense again. Define installment reporting before implementing cards.
- Record currency and use precise monetary arithmetic. Multi-currency consolidation requires an explicit conversion policy and is not assumed for the first release.
- Initial investment tracking uses manual positions and valuations. Automated prices, returns, and tax calculations require separate scope and data rules.
- Reserve coverage uses a documented monthly expense baseline. Goal allocations must not silently allocate the same funds beyond their available amount.

## Flow
Create accounts and opening balances → enter transactions or upload a statement → review parsing and duplicate candidates → confirm → refresh balances and summaries.

## Dependencies and open decisions
- Future separate user accounts are required; authentication, cross-device synchronization, and any shared-data permissions remain to be defined.
- Hosted PostgreSQL on Supabase is selected; offline behavior, synchronization, backup, and restore strategy remain to be defined.
- Initial import format: the supplied Mercado Pago account-statement PDF. Additional banks, formats, and card-statement samples remain to be identified.
- Initial currency and reporting conventions.
- Whether card statements are required at launch.
- Raw statement retention and deletion policy; avoid retaining files without a product need.

## Risks
Double-counted transfers, investment balances, card payments, and goal allocations; stale valuations; duplicate imports; differing statement formats; data loss without backup; exposing sensitive financial data.

## Deferred unless explicitly requested
Bank connections/Open Finance, notification capture, automatic trading, tax filing, shared household finances, and native application packaging.

## Private workspaces
A user selects a financial workspace from cards and can create additional spaces with a name, optional description and color. Each space owns its accounts, categories, movements, imports and financial backups. Existing records migrate to “Pessoal”. Totals never aggregate across spaces. Selection is remembered per user; switching clears financial screen/cache state. Membership, invitations and shared access are deferred.
