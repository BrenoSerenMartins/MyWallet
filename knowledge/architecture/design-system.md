# Design system

## Purpose and direction
Proposed visual direction: a polished personal-finance app with the clarity and tactile feel of a banking application. Build depth through layered surfaces, spacing, restrained light, and clear visual hierarchy. The product manages finances; labels must not imply that MyWallet holds money or executes bank payments.

## Themes and tokens
Support `light`, `dark`, and `system`. Start with the system preference and persist an explicit override locally. Apply the resolved theme before first paint, update the browser theme color, and respond to system changes only in system mode. Theme initialization must work with the production Content Security Policy.

| Semantic token | Dark | Light |
| --- | --- | --- |
| Background | `#081116` | `#F4F7F8` |
| Surface | `#102027` | `#FFFFFF` |
| Raised surface | `#17313A` | `#E8EFF2` |
| Text | `#EAF2F5` | `#102129` |
| Muted text | `#A7BCC5` | `#52636D` |
| Primary action | `#5EE9B5` | `#08664B` |
| On primary | `#062019` | `#FFFFFF` |

- Define colors, typography, spacing, radii, elevation, motion, and chart colors as CSS custom properties. Components consume semantic tokens rather than hardcoded theme colors.
- Use a 4px spacing scale; standard surface radii around 16–24px, controls around 10–12px. Reserve pill shapes for badges and compact filters.
- Use locally bundled Inter or a system sans-serif fallback; use tabular numerals for amounts and right-align numeric columns.
- Keep hero balances prominent and supporting numbers quieter. Use a subtle emerald glow or gradient on the balance area; avoid translucent treatment over transaction text.
- Income, expense, transfer, warning, and error get separate semantic treatments, with labels/icons as well as color. Validate every implemented state in both themes.
- Initial contrast checks for the specified main text, muted text, and button pairs exceed 4.5:1. This is a palette check, not a completed interface accessibility audit.

## Navigation and layout
- Desktop: sidebar around 240px, top bar with active period/profile/theme controls, and a bounded content area. Home uses a balance hero, quick actions, monthly summary, recent movements, and an account overview.
- Tablet: compact navigation and a two-column layout where space permits.
- Mobile: five bottom destinations: Home, Transactions, Accounts, Planning, and More. Respect safe areas and the on-screen keyboard. Keep the primary create action reachable without covering content.
- More opens an accessible dialog containing imports, groups/categories, preferences and workspace switching. Desktop navigation has expandable money/organization sections. Future areas join navigation only when functional.
- Detailed views drill into accounts, transaction details, and import batches. Carry period and account filters into the detail view and support browser Back.
- Use tables for desktop transaction review and compact transaction rows on mobile. Show direction/type, description, date, amount, and review state without horizontal scrolling for the main workflow.

## Screens and flows
| Surface | Core content and behavior |
| --- | --- |
| Authentication | Sign in, sign up, verification feedback, password recovery; clear error and expired-link states |
| First use | Create the first account, choose opening balance/date or obtain them from a validated statement |
| Home | Tracked balances with coverage label, selected-period income/expenses, shortcuts, recent transactions |
| Accounts | Institution, account type, recorded balance, statement coverage and transaction history |
| Transactions | Search, period/account/category/type filters; detail, create, edit, and explicit reversal/removal confirmation |
| Import | Account selection → upload → extraction summary → review/corrections/automatic duplicate exclusion and ambiguous-match decisions → confirmation receipt |
| Import history | Status, counts, reconciliation, and batch reversal with a clear impact preview |
| Categories | Income/expense switcher, searchable expandable groups, category editing/moves and a protected default group |
| Settings | Appearance, data/backup and account sections in a view switcher |

## Components and interaction
- Shared UI: Button, IconButton, Field, MoneyInput, DateField, Select, Dialog, Sheet, Tabs, Badge, Toast, Skeleton, EmptyState, and ErrorState. Create components when a real screen needs them.
- Shared financial presentation: Amount, TransactionRow, AccountIdentity, and BalanceVisibilityControl once reused. Keep financial calculations outside these components.
- Home sections remain separate components; pages compose sections and feature hooks rather than own rules or networking.
- Use one focused task per form. On mobile, prefer a full-height sheet or page for long entry and import review; preserve unsubmitted values after recoverable errors.
- Provide explicit loading, empty, populated, validation, offline, session-expired, and server-error states. Never show demonstration transactions or placeholder balances as real user data.
- Use 160–220ms transitions for feedback and surface changes. Respect reduced motion and keep amount readability stable during loading or theme changes.
- Aim for at least 44px touch targets, visible keyboard focus, properly associated labels, accessible dialog focus, announced upload status, and table/text alternatives to charts.
- Amount hiding is a convenience for screen privacy; it is not access control. Clear private screen data and in-memory query caches at sign-out or user changes.

## Pilot boundaries
Home initially reports tracked account balances, not complete net worth. Investments, assets/liabilities, reserve goals, and general goals arrive in later releases. Do not fill those sections with fabricated figures or nonfunctional controls.

## Visual acceptance
Validate at 360px, 390px, 768px, and 1440px; check both themes plus system theme changes, long descriptions, large/negative amounts, keyboard interaction, and reduced motion. No clipped main actions, overlapping bottom navigation, or loss of form state during theme switching.

## Information hierarchy update
Import upload/history use separate views. Review separates all/pending/ready/locked duplicates, keeps source reconciliation and consultation-only retention in disclosures, and exposes grouped category selectors. Mobile review uses stacked rows and full-width 44px selects instead of shrinking the desktop table. Counts and labels remain explicit; confirmed duplicates cannot be selected through either UI or API. Transaction lists show group/category context and have type switchers plus expandable account/category/date filters. Planning groups collapse independently without recalculating financial totals in UI. Existing theme tokens and focused keyboard/native disclosure controls remain authoritative. PWA shell version advances to v4.

The category page uses a compact heading, expense/income switcher and search. Groups are accessible keyboard-navigable tabs, with the protected default Geral always first and sticky while horizontally scrolling. The selected group shows one compact category list; search lists matching categories across groups with group context. Group actions and add-category share the list header. Category rows have semantic red/green indicators and a delete action; group tabs alone show custom group colors. Categories have no color picker; group forms retain customization/reset. Existing stored category colors are not rewritten on load; saving a category normalizes its color to its type default.

Import review exposes a focused reprocessing dialog for drafts/history: saved data versus resupplied original, preserved reviews by default and explicit classification reset. State limitations and no-financial-write behavior are visible before execution.

The category section uses negative/positive theme tokens for selected switcher state, group icons, subtle card borders and chip backgrounds. Brand navigation and primary actions retain the emerald identity. Custom group/category colors remain secondary identity dots, including previously saved green expense groups; semantic context does not rewrite saved colors. Expense/income explanatory copy follows the active section.
