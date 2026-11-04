# Cards, investments and recorded net worth

Delivery scope: manual credit-card registration, installments and bill cycles, partial/full bill payment by a real bank account or by linking its imported debit; investment positions with contributions/redemptions/distributed income and dated manual valuations; other assets/debts and a recorded net-worth view. No automatic bank/card investment import, live quotes, tax calculations or trading is implied.

## Accounting boundaries
- Managed `credit_card` and `investment` accounts are internal ledger containers, not additional supported bank import layouts. Public bank-account registration remains Mercado Pago/Alelo. These managed accounts never inflate available cash or benefit balances.
- Card installment expenses belong to their bill's due month. Their full remaining principal contributes to card debt/used limit. Payment transfers cash to the card account and is excluded from expenses. Linking an imported bank debit preserves source evidence and reclassifies that debit as the transfer leg. A movement cannot pay two bills or both a bill and a regular commitment. Manual payment records are reversible; imported payments can be reassigned without removing the bank fact.
- Purchases on a configured closing day enter the following cycle. Short months clamp configured days. The user can explicitly choose the first bill month when the issuer assigns a different cycle. Issuer dates are configurable; no universal posting-time assumption is asserted. Opening debt is registered as prior debt, without inventing current-period spending. Fees/interest must be entered from issuer facts.
- Investment contributions and redemptions move cash through paired transfers. Redemption gain/loss is recorded separately from returned capital; dividends are income. Existing holdings may be opened with historical capital/value without debiting cash again. Valuation changes update the portfolio's dated market value, not cash and not realized monthly income.
- Net worth uses recorded cash/reserves + manually valued investments + other assets + card credits, less card debt/overdrafts/other debts. Benefits are shown separately and excluded. Investment book accounts are not added again on top of market values. Holding gains distinguish contributed capital, realized results and unrealized valuation changes.

## Delivery checklist
1. Workspace-owned tables, forced RLS/composite foreign keys and managed ledger safeguards.
2. Versioned/idempotent card, investment, valuation and payment operations; consistent account/record lock order.
3. Card debt integrated into cash-flow forecast without a second monthly expense; links protected against conflicting commitment use.
4. Dedicated responsive modules with bills, purchase/payment review, holdings, dated valuation and asset/debt inventory; discoverable navigation and privacy controls.
5. Portable versioned backup/restore with all managed identities remapped and older archives retained.
6. Meaningful database/domain, accounting, isolation and browser checks. Apply migration before publishing dependent code.

## Implementation and validation (2026-11-04)
All six delivery items are implemented. The cards/investments migration was confirmed applied by the user. Domain and database verification passes 206 tests across 30 suites, including linked payments, investment capital/income separation, reversals, isolation and backup restoration. Type checking, lint, module boundaries, production builds and credential scanning pass. The browser suite includes card/investment workflows, small-screen reflow and the benefit-month toggle, but the final browser rerun is blocked by local-network permissions (`connect EPERM 127.0.0.1:5173`) in the current environment. No browser pass is claimed for this final revision.

Backups now use version 10 and retain support for older archives. Version 9 introduced managed finance records; version 10 additionally preserves the per-benefit-account planning month preference.

## Benefit planning month
Alelo Food/Meal accounts can count positive income in the month received (default) or the following month. This preference applies retroactively and to future planning summaries, independently for each benefit account. It can be changed from the account form or directly from Planning, with account-version conflict protection. Ordinary accounts cannot enable the shift.

Only planning income recognition changes. Original transaction dates, account balances, expense dates, transfers and source-date dashboard cash reports remain intact. A credit dated October 30 can therefore count toward November's planned-versus-actual income without creating another transaction; credits paid November 1 can remain in November using the default. The new `202611040001_benefit_planning_month.sql` migration must be applied before publishing dependent code.
