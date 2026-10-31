# Current-balance reference and usability refinement plan

Status: implemented on 2026-10-31; financial and Chrome browser validation completed as recorded below. Native phone/Safari validation remains pending. No database migration was needed. It builds on the existing top navigation, mobile bottom navigation, monthly charts, category/group views, workspace trash and balance audit.

## Outcome and boundaries

Make current balance explainable and dependable despite gaps in imported history, while making common tasks comfortable on mobile, tablet and desktop. Automatic bank-reference selection belongs exclusively to the Mercado Pago account-statement mapping. Alelo and all other institutions retain the existing audited manual calibration behavior. EDI remains outside public consumer ingestion.

Current bank position, accounting history and monthly performance are distinct views. Earlier transactions remain available for reports and planning; a source balance is an observed position, not a new receipt/expense or a claim of complete history. The overview never implies a live bank connection. Existing transfers, duplicate exclusion, source proof, refunds, ownership/workspace isolation, reversals and backups remain authoritative.

## Phase 1 — Financial contract and source evidence

1. Inventory supported MP PDF/CSV/XLSX layouts and record which expose opening, closing and per-row balances. Inspect private fixtures locally; do not commit source files or identifiable financial data.
2. Define a source reference with account/institution, amount in integer cents, source date, position kind (before first row / after identified row / closing), batch and immutable source identity, and source sequence/timestamp when actually supplied. Keep source date separate from import/confirmation time. Transaction external IDs and upload order do not prove chronology.
3. Define exact coverage of ledger movements by the reference. A closing amount already includes source movements through that point. Only proven later movements affect current balance beyond the observed amount; missing earlier history is not added again.
4. Same-day ordering uses actual source order, running balances and overlapping source evidence. Calendar day alone, import order or a fabricated timestamp must never decide that an ambiguous operation occurred before/after the reference.
5. Source acceptance requires successful MP mapping/validation, correct account and explicit import confirmation. Draft/history-only/reversed sources cannot silently become active bank references. Valid observed position does not assert that all historical transactions were imported; partial transaction selection must remain visible in import results and must not create omitted financial rows.
6. Specify precedence for later proven MP references, equal/overlapping sources, conflicting facts, and an existing manual observation. A bank reference proved later may supersede a manual MP basis with audit; ambiguous same-day or contradictory facts require a focused review instead of an arbitrary overwrite. Older file ingestion must not replace a newer valid reference.

Deliverable: documented reference/cutoff and precedence contract, typed integration/HTTP/backup changes and migration decision. Reuse current basis/audit infrastructure where it can represent the contract; add minimal schema only if source boundaries/membership cannot otherwise be preserved.

## Phase 2 — Reference selection and lifecycle

- Reevaluate the newest valid MP bank position after confirmation, source reconciliation, reversal, ledger changes and restoration. Selecting a reference must not require a continuous sequence of monthly files.
- Current balance = proven source reference + applicable net movements after its cutoff. Translate that position into the existing effective-base projection without altering recorded transaction amounts or fabricating correction income/expenses.
- Preserve older transactions in monthly/category/group reports, including uncategorized typed movements. Statements arriving out of order, filling a gap or repeating evidence must not double count money.
- On reversal, discard that source's eligibility and deterministically choose the newest remaining valid reference or restore the prior manual/unknown state. Repeated commands remain idempotent; account locks/version checks protect concurrent confirmation/correction/reversal.
- Audit reference changes with previous/new basis, source identity and reason. Backup/restore must retain identity remapping, cutoff semantics and audit. Do not silently reinterpret existing manual references during rollout.
- For accounts without a usable MP balance fact, retain the established manual calibration fallback. Alelo remains unchanged, including historical import rebasing and manual observation membership.

Financial acceptance cases: January–June plus August–October with July missing; import July afterwards; no movements across intervening days; latest closing or row reference; positive/negative/zero balances; overlapping and equal-day exports; unknown same-day order; manual entries before/after reference; duplicates; refunds and reserve transfers; partial/history-only imports; source reversal; simultaneous confirmation/correction; retries; archived/deleted spaces; cross-user/workspace references; old and new backups. Verify current balance changes independently from unchanged monthly totals.

## Phase 3 — Shared interaction and visual foundation

- Preserve the emerald identity and light/dark/system themes. Standardize type scale, 4px spacing rhythm, restrained borders/elevation and meaningful semantic colors. Use readable 14–16px task text; reserve smaller secondary labels for genuinely secondary content. Align money using tabular numerals and consistent currency/sign formatting.
- Define hot/hit areas as actual activation regions: target at least 44×44 CSS px for standalone controls, aiming for 48px primary mobile controls with separation. Icon artwork may stay small inside a larger target. Keep destructive actions separate from frequent navigation/confirmation controls.
- Use one clear primary action per task region. Row selection, detail opening and overflow actions have distinct targets and correct button/link semantics, without nested interactive elements or accidental full-row activation.
- Use familiar, consistent labels, visible focus and explicit pressed/selected states. Hover is supplementary; nothing essential depends on it. Maintain visible controls while loading, preserve form input on recoverable errors, and announce results without replacing financial data with generic success text.
- Ergonomic placement is a hypothesis to validate with representative tasks, not a measured heatmap. Do not install session replay or collect private financial data as part of this refinement.

Deliverables: small set of reviewed shared controls, amount/status presentation, contextual action bar, mobile sheet and desktop detail panel. Extend existing primitives rather than introduce a new UI framework or rebuild every screen independently.

## Phase 4 — Mobile and tablet layout

- Keep five stable bottom destinations and a compact workspace header. Frequent task actions belong in reachable contextual controls. Avoid duplicate global/page create buttons competing in a narrow viewport.
- Establish priority by screen: current balance and reference first on home; description/date/amount first in transaction rows; unresolved items and confirmation summary first in import review. Secondary provenance and long explanations stay in disclosures.
- Use single-column task layouts, readable fields (16px mobile input text), and full-height sheets/pages for long forms. Keep save/confirm reachable while respecting safe areas, dynamic viewport, on-screen keyboard and the bottom navigation. Fixed bars must not cover focused fields, errors or final rows; avoid stacking multiple sticky footers.
- Review/import rows become mobile-native stacked items, with separate selection and detail actions. Batch selection/classification is explicit, scoped to the visible filter, previews affected counts and preserves locked duplicate rules.
- Keep selected month, filters, scroll position and unsaved form state across detail/back transitions when applicable. Avoid nested scrolling for everyday forms and main transaction workflows.
- Tablet layouts depend on available content width, not a device name. Split panes and two-column cards appear only when labels and primary controls still fit comfortably.

## Phase 5 — Desktop layout

- Preserve compact top navigation and a consistent bounded content grid. Reuse horizontal space for meaningful comparisons and list/detail workflows, not oversized empty cards or additional navigation chrome.
- Balance actual amount, source/status and actions visually. Show related KPIs together and remove duplicate presentations of the same amounts. Clearly distinguish planned-versus-actual variance from previous-month variance.
- Transactions/import review use aligned financial columns, searchable filters, stable row height, explicit row actions and a detail panel that preserves list context. Keep essential amounts and actions visible without a hover requirement.
- Charts retain exact-value alternatives and signed axes. Hover/focus/touch select the same month/category details; controls and legends stay legible. Long chart/table horizontal scrolling is contained locally; the whole page does not scroll sideways.

## Phase 6 — Screen-by-screen refinements

| Area | Changes and acceptance focus |
| --- | --- |
| Overview | Current recorded balance, source/date and view-source action; separate monthly scope; compact comparative presentation; expandable composition; amounts/charts/table all honor privacy |
| Accounts | Institution-specific balance-reference state; reference/history/correction actions organized by priority; MP can show automatic/manual source, Alelo shows manual calibration and last observation; empty filtered states are explicit |
| Import/review | Preview and receipt distinguish confirmed movements from balance-reference changes; explain previous/new current balance and source used, or why reference remained unchanged; clearly separate duplicates, unresolved items and ready items; no repeated confirmation after a successful command with a failed refresh |
| Transactions | Description/date/amount/type hierarchy, useful category/agent context, distinct row/detail controls, obvious active filters/reset and preserved return path |
| Planning | Expected/actual/variance readable together; uncategorized actuals remain included; month/scope and unavailable contribution actuals are explicit; editing avoids excess switches |
| Groups/categories and people | Compact lists/tabs, discoverable edit/move/archive actions, readable long labels, protected default state, clear automation impact and reversible review where supported |
| Workspaces/settings | Sole-space entry retained, easy deliberate switching, clear current workspace, separated delete action, exact seven-day restore deadline and existing trash behavior |
| Forms/authentication | Consistent fields, validation/focus, password recovery and offline/expired-session states; long forms remain usable with mobile keyboards |

Reference-copy examples: MP “Referência do extrato de 30/10 · ver origem”; Alelo “Saldo corrigido por você em 30/10”. Show “Registrado até…” rather than claiming bank balance is live. A history gap may affect period reports without invalidating a more recent proven bank position; explain this distinction where relevant.

## Phase 7 — Verification and delivery gates

1. Prepare reviewable desktop/mobile layouts for Overview, Accounts and Import Review before propagating the shared visual pattern. Validate with actual screen dimensions and synthetic/authorized source data, not just an ideal populated example.
2. Test 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS px, plus constrained landscape height and intermediate breakpoints. Include both themes, system changes, 200% text enlargement and 400% browser zoom/reflow checks.
3. Verify keyboard-only flow, screen-reader labels/order, visible/non-obscured focus, target geometry, text/control contrast, reduced motion and touch operation. No color-only financial meaning; primary tasks must have no page-level horizontal scrolling. Contain inherently two-dimensional charts/tables and provide usable text alternatives.
4. Exercise loading, empty, partial, pending, offline, expired session, validation failure, server failure and retry states. Large/negative amounts, long names, hundreds of import rows, zero denominator comparisons and bottom-bar/keyboard interactions must remain usable.
5. Run exact-money/source-boundary and isolation tests, generated contract checks, lint/types/build, migration/backup tests where applicable and focused browser scenarios. Verify on a real touch device as well as desktop. Browser checks blocked by tooling remain explicitly pending; do not label visual acceptance complete from a successful build alone.
6. Validate key tasks: identify amount and freshness of current balance, inspect its source, import/confirm a statement, explain the balance change, correct Alelo, filter/edit a movement and return, compare periods, edit a plan, switch/restore spaces. Record errors and friction and refine before rollout. “Premium” is assessed by coherent execution and successful tasks, not a promise of perfect usability.
7. Apply any required migration before deploying dependent code. Deliver small verified increments: financial source contract and projection → reference UI on Overview/Accounts/Imports → shared mobile/desktop controls → remaining screen refinements → visual/task acceptance.

## References

- [W3C target size enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced): 44×44 CSS px with defined exceptions; the 48px mobile goal above is a product choice, not a WCAG AA requirement.
- [W3C reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow): narrow layouts, text enlargement and focus visibility concerns with fixed content.
- [WCAG 2.2](https://www.w3.org/TR/wcag/): applicable contrast, focus, operation and status-message criteria; a target for validation, not an existing conformance claim.

## Delivery record — 2026-10-31

Implemented MP closing references with canonical operation evidence and same-day coverage membership. Confirmed validated MP account sources alone participate; newest dates win, same-day endpoints require proven source overlap, and contradictory/ambiguous facts are flagged. The effective base offsets covered history; no financial transaction is fabricated or rewritten by reference selection. Older imports and missing months do not add pre-reference money again. Source selection/correction/reversal/undo and restored backup references are covered by domain/database tests. More recent manual observations remain authoritative; newer proven bank dates can supersede older manual MP observations. Alelo remains manual.

Legacy MP references are upgraded once on Overview/Accounts access under a verified writable transaction, with account locks and append-only audit. Eligible newer confirmed bank dates can upgrade an older manual MP observation; older or same-day ambiguous sources cannot silently do so. These GET paths refresh the derived projection; they never create ledger rows. An explicit version-checked account action is also available. Import confirmation defers per-row balance rebasing until the batch's movements and source evidence have been written atomically.

Source reference JSON reuses existing basis/audit/membership storage, so there is no new migration. Backup output is v7; v1–v6 remain readable with their original semantics. Closing-reference fields require v7 and are restricted to MP. The current reference-aware API is required to operate these new positions; older code must not reinterpret them as opening anchors.

UI delivery includes source/date links in Overview/Accounts/import detail, current-balance confirmation receipts, explicit scoped bulk selection/categories, broader touch targets, readable text, mobile sheets constrained by dynamic/visual viewport, contextual save/confirmation controls, desktop transaction detail panels, URL-preserved filters and browser Back, clearer audit presentation, compact desktop current-balance layout and chart comparison strips, rounded chart axes, and preserved privacy. Workspace appearance controls move out of the narrow header to prevent overflow. Existing category/agent/planning/auth/settings flows receive the shared control/typography/focus refinements.

Validation: 168 domain/database tests across 27 suites passed; 65 existing/expanded browser scenarios passed together, plus the new bulk-review and OS text scale/reflow scenarios and confirmation receipt assertions passed in focused runs (67 unique scenarios). Chrome checks cover 320/360/390/430/768/1024/1280/1440/1920px, both themes, keyboard focus and Back, reduced viewport height, source/amount privacy, 2× emulated OS text scaling and a 320 CSS-pixel reflow viewport at device scale factor 4. These are emulations, not a native Safari/real-handset certification or a general accessibility conformance audit. Screenshots of populated synthetic states were inspected. Build/types/lint/boundaries/secret/contract/format checks passed, with final touch checks recorded in the impact matrix. No live customer import or manual balance change was performed by the agent.
