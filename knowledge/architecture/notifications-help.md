# Notifications and contextual help

## Product behaviour
Transient action acknowledgements use floating popups instead of permanent success banners. Account/transaction/category saves, planning changes, card and wealth operations, workspace deletion/restoration, reprocessing and import confirmation publish their results through the shared notification provider. Connection loss/recovery and app updates use the same system. A small offline header indicator remains because it explains why write controls are unavailable.

The bell opens a session history, limited to the latest 40 notices. Opening history marks notices read and dismisses their floating copies, including queued notices. Three popups can appear at once; further active notices wait their turn and remain accessible from history. Success/info notices expire after a message-length-aware reading period; errors/warnings persist until dismissal. Hover, keyboard focus and a background tab pause expiration. Update actions remain accessible in history. History is in memory, with no account notification persistence or operating-system push implied.

Notification history clears on a workspace change or identity change. Workspace-scoped callbacks capture a generation: a request finishing after a space switch cannot publish into the new space. Workspace-management/authentication acknowledgements explicitly use the session scope. No source financial data is changed by feedback delivery.

## What stays contextual
Field validation remains in its form. Loading failures keep their retry action beside the unavailable content. Duplicate exclusions, balance conflicts and other decisions that affect confirmation remain visible near the relevant records. Generic explanations can be reduced to a short coverage label plus explicit help; essential facts are not hidden behind hover.

## Tooltip contract
`Tooltip` decorates an existing native control without a layout wrapper, preserving its label, ref and event handlers. Icon actions remain one-tap actions. Hover and keyboard focus provide short descriptions; `HelpTip` provides an explicit tap/keyboard toggle for financial concepts. Text is also linked with `aria-describedby`. Popups clamp to the viewport and choose above/below placement, dismiss on outside interaction/Escape, and stay readable while hovered. Escape dismisses an open tooltip before dismissing a dialog.

Use help for available money versus monthly result, planning scope and benefit month, investment/net-worth boundaries, invoice credits and compact icon actions. Keep primary labels and important constraints visible. Do not nest help buttons inside links or implicit form labels.

## Verification
Browser regressions cover floating feedback without layout shift, manual dismissal/history recovery, timeout pause, workspace isolation including a late request, keyboard/Escape handling and touch help with single-tap actions. Playwright discovers 105 scenarios; execution remains blocked by this environment's local server/Chromium permissions. Domain/database verification passes 206 tests in 30 suites. Final code checks are recorded alongside the implementation; browser discovery is not a browser pass.

Implementation checks: lint is clean, type checking and production builds pass, and the frontend credential scan passes. Mounted live regions provide separate polite/assertive announcements without repeating the visual toast content. Tooltip integration adds no package dependency. This change requires no database migration.
