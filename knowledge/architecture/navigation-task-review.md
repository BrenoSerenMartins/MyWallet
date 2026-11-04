# Navigation and task layout review

This revision changes information architecture and task flow, on top of the shared interface system. It keeps financial calculations and supported import layouts unchanged.

| Area | Main question | Visible by default | Secondary content / actions |
| --- | --- | --- | --- |
| Overview / Summary | What do I have now and what is coming? | Current balances, portfolio summary, compact forecast, monthly totals, recent movements | Account composition, full commitments in Planning |
| Overview / Analysis | What changed and where did spending go? | Monthly comparison, range/format controls, expenses by group/category | Current balance workspace is hidden; privacy remains available in the page header |
| Movements | Which entries need finding or organising? | Search, financial types, loaded result count, removable active-filter chips | Account/category/date controls expand; entry details remain a dedicated dialog |
| Accounts | Which account holds this money? | Compact account rows, balance, product, coverage warning, direct movements | Source/history expand; correction and editing remain explicit |
| Cards | Which bill needs attention? | Card selector alongside the selected bill on desktop; scrollable selector before the bill on mobile | Purchase history, prior debt and payment audit stay secondary |
| Planning / Budget | What did I plan and what actually happened? | Period and edit action in the header, compact actual-scope selector, comparisons and category groups | Copy previous month, calculation/benefit settings, notes |
| Planning / Commitments | What still needs paying or receiving? | Due period, forecast, actionable occurrences | Recurrence settings and payment linking in their task dialogs |
| Wealth / Investments | What is the current portfolio? | Wealth totals, investment list and contextual create action | Composition/cost explanation below the workspace, holding operations in detail |
| Wealth / Assets and debts | Which positions are missing from accounts? | Inventory and contextual add-position action | Edit/archive details |
| Wealth / History | How did recorded wealth evolve? | Recorded history and contextual capture-position action | Snapshot composition and readable history table |
| Imports | Where is my file in the process? | Send/review/complete step indicator, destination and upload, file name during review | Process guide expands; previous files live in History |
| Categories | How are my receipts and expenses organised? | Financial type, search, group tabs/counts, category list | Group/category editing and deletion dialogs |
| People and establishments | Which names are recognised automatically? | Search, automation filter, existing relationships | New record in a dialog; identifiers and rules expand per record |
| Settings | Where do I change appearance or manage data? | Dedicated Appearance / Data / Account areas; labelled theme previews | Backup/restore remains in Data; selected area survives reload and Back |
| Workspaces | Which isolated set of finances do I want? | Existing spaces, active space and create action | Trash and destructive actions retain their confirmation flows |

## Navigation decisions
Five desktop destinations cover overview, movements, accounts, planning and wealth. Account/card subnavigation connects holdings and bills without treating card debt as cash. Mobile retains four daily destinations plus the complete grouped menu. The global new-transaction action appears on the overview only, avoiding an unrelated duplicate action on every feature page. Each other area owns its primary task action.

Overview view and period are encoded in the URL and preserve one another. Settings also retains its selected area in the URL. Search/filter changes preserve independent constraints, and removable movement filter chips expose constraints that would otherwise be hidden inside the advanced filter section. Result counts describe loaded records rather than pretending to represent an unrequested database total.

## Validation
Browser regressions cover summary/analysis navigation and privacy, period retention, account filter empty states and card navigation, directory creation failure/retry and automation filters, independent movement filter removal, settings reload/theme selection, plus all-route mobile/desktop/theme reflow checks. The current environment blocks Chromium launch (`sandbox_host_linux.cc`, Operation not permitted) and local server access; discovery/static checks can run, but final browser execution requires a browser-capable environment. Do not describe browser execution or a perfect usability score as verified.

Validation result: `npm run verify` passes, including all 206 domain/database tests in 30 suites, lint, type checking, module boundaries, production builds and credential scanning. Playwright successfully discovers 98 scenarios. Browser execution remains blocked before server/browser startup; no screenshot pass or perfect usability claim is made. This revision requires no database migration.
