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
