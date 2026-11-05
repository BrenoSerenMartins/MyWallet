# Shared interface system — November 2026

The visual revision covers the entire product: overview, accounts, movements and detail forms, file upload and review, budget, commitments, category groups, counterparties, cards/bills, investments/net worth, settings/data controls, workspaces and authentication.

## Design ownership
- `tokens.css` defines the light/dark neutral palette, financial semantic colours, brand mark, spacing and radii. Green/red describe financial direction; navigation and primary actions do not reuse income green.
- `experience.css` defines shared surfaces, headers, controls, disclosure patterns, feedback, navigation, portal dialogs and the visual treatment of each feature. Feature styles retain their domain layout, chart and responsive table rules. Rules are scoped to product classes; financial category colours and saved workspace choices are retained.
- `PageHeader` supplies the same title, optional description and actions hierarchy to all twelve signed-in page variants. This removes competing page-specific heading markup. The auth entry uses the same tokens and controls, with a simple editorial feature list instead of decorative orbit illustrations.
- The main navigation stays horizontal on desktop and within thumb reach on mobile. The additional menu groups finance and organisation links, including cards and wealth, and restores focus after closing.

## Content hierarchy
The overview places the account snapshot beside a secondary portfolio summary, followed by cash-flow and monthly analysis. Account cards use restrained bank marks and compact management actions. Movement search, financial-type tabs and expandable filters belong to one workbench. Import upload takes precedence over its process guide; review tables keep their responsive row treatment and confirmation controls. Category and counterparty lists, settings, bills and investment records share the same surfaces and typography rather than individual decorative card themes.

Budget reporting retains the unified planned/actual comparison and group totals visible before expansion. Explanations and benefit month preferences remain disclosed on demand. No source date, reporting rule or financial total changes in this visual revision.

## Interaction and verification
Controls target at least 44px on desktop and 48px on mobile; focus rings, native form labels, Radix dialog focus handling, reduced motion and safe-area spacing remain in place. Narrow layouts wrap actions and values instead of clipping information. Both themes are supported throughout, including dialog portals and workspace selection.

Browser regressions cover every signed-in route at mobile/desktop widths in both themes, capture page screenshots, check document overflow and primary target sizes, verify navigation to cards/wealth and exercise a narrow large-text account form. They require a browser-capable environment; the current sandbox blocks Chromium launch and local-network access, so a final visual/browser pass cannot be claimed here. Run `npm run test:e2e` on the development machine for the complete interaction suite.

Final checks: 206 domain/database tests in 30 suites passed, along with lint, type checking, module boundaries, production builds and credential scanning. Playwright discovers all 93 scenarios, including the new route/theme/navigation regressions, but execution is blocked by the sandbox before the browser/server starts. The account card keeps movement access, correction and editing visible while reference recalculation and history sit behind an accessible native disclosure.

## Number-led workspaces

Overview keeps its view switcher inside the balance card. Budget and wealth now attach their section navigation to the bottom of their numerical summary. Accounts, cards and commitments use compact page headers: the page title remains an accessible h1, while visible controls concentrate on period, creation and local navigation. Descriptive headings remain in task-heavy organisation/import flows. Values, reporting rules and audit actions are unchanged. `PageHeader.compact` centralises this visual choice. Browser scenarios that expect visible h1 text on these routes must instead check semantic presence and the visible summary/task controls; compilation is not a browser pass.


## Contextual actions and compact selectors

Budget actions (month, edit and scope/copy menu) are inside its numerical summary; wealth actions remain inside its position summary. Account creation and type selection share a directory toolbar. Category, counterparty and movement creation share their search/filter toolbar. Cards use an owned workspace toolbar rather than controls aligned to an invisible title. Preferences, import sections and commitment status use the shared accessible Select; overview/wealth analysis and financial category direction retain visible tabs for frequent alternate readings. Desktop account/card navigation remains in the header dropdown and mobile access is preserved. No financial calculation or persistence changes are introduced. Lint and frontend compilation validate this revision; visual browser verification and maintenance of older browser selectors remain outstanding.

## Empty-state consistency

`EmptyState` accepts a contextual decorative icon and a compact mode for nested collections. The shared scale matches the card directory: 64px icon, restrained 20px heading, readable 13px explanation, bounded width and responsive padding. Icons use the area's vocabulary (accounts, categories, people, imports, planning, investments and activity) rather than repeating a wallet everywhere. Nested category groups, expense analysis, history and empty bills use the compact version.

An empty filtered result explains how to adjust filters; an empty first-use area points to the existing creation action without duplicating it. Movement results offer filter reset when a query is active rather than suggesting a new import. Existing card onboarding retains its specific credit-card artwork. Errors and loading are not styled as successful empty results. Financial values and data persistence are unchanged.

## Unified overview

Overview no longer gates complementary information behind Summary/Analysis. Current balances lead the page; the monthly totals, expense distribution and evolution are visible together, followed by upcoming cash flow and recent movements. Cards/investments/net-worth links are grouped in a secondary disclosure. The monthly chart uses a Select for interval and retains Bars/Lines for representation. Existing `view=analysis` links still render the unified page; changing the selected month removes the obsolete parameter. Balance privacy applies to all sections. Browser regressions follow the unified flow and interval selector, but discovery/compilation are not a visual execution pass.


Overview reading order was refined after user review: current balances, monthly numbers, recent movements, monthly evolution, secondary portfolio disclosure, and upcoming commitments last. Expense distribution is no longer rendered on Overview. The standalone component remains available for a future dedicated report; monthly totals and API calculations are unchanged.

## Editorial overview trial

The overview alone loads `overview-editorial.css` after its feature styles. A scoped `overview-editorial` class removes enclosing cards from balances/month/history, increases balance typography, removes repeated metric icons and secondary copy, and uses thin section rules. Monthly figures retain all amounts/comparisons; result carries financial color while income/expense amounts remain neutral. On mobile, income/expense share a row and result occupies its own row. Interactions, privacy, calculations and the order of content are unchanged. This is a reviewable visual trial, not a global redesign. Lint and production compilation pass; actual appearance requires browser review in an environment where the local server/browser can run.
