# Next-cycle execution status

Updated: 2026-11-05. Implements the order in [the action plan](action-plan-next-cycle.md).

## Baseline captured

- `npm run verify`: passed, 36 suites / 232 tests, API/app types and production builds, module boundaries and frontend credential scan.
- `npm run contracts:check`: passed; generated OpenAPI and transport types are current.
- Strengthened existing managed-finance recovery test: compare all named account balances, card debt/credit/available limit, cashflow projections, planning totals and net worth after restoring into another owner. Repeat restoration must preserve the same financial state without adding transactions; restored IDs differ from the source. Targeted suite passed: 19 tests.
- Browser suite: 134 tests discovered. Discovery is not execution.
- Local browser execution fails before tests: loopback connection EPERM and Chromium sandbox shutdown `Operation not permitted`. Explicit `--no-sandbox` does not resolve the host restriction. GitHub API is also inaccessible here; remote results cannot be inspected by this agent yet.

## Changes in this increment

- Replaced stale expectations for retired expense breakdown, account tabs, per-page header count and old control placement.
- Preserved assertions for financial values, date presets and filtered requests, keyboard focus and task access.
- Configured loopback server consistently, traces/screenshots retained on failure and an HTML report in CI.
- Browser CI runs independently in three shards, with reports uploaded even after failure, so a separate audit failure cannot suppress browser evidence.
- Corrected current-scope claims in README, architecture overview and frontend routes.
- Defined the sharing permission matrix and compatibility model in [workspace permissions](workspace-permissions-plan.md). This is design, not a change to runtime authorization.

## Open verification gate

Phase 1 remains in progress until browser CI runs successfully and failures are triaged. Device validation of keyboard/safe-area behavior remains separate from emulated viewport assertions. The agent requested the Quality/Playwright result from the user because local browser execution and GitHub API access are blocked.

Do not report the full plan complete. No new financial schema or migrations have been introduced in this increment. Goals, persistent alerts and sharing remain planned; recognition candidates already exist, and their review improvements remain planned.

## Next executable actions

1. Inspect each uploaded browser report; repair actual application regressions and remaining obsolete expectations without weakening task/financial assertions.
2. Run the recovery/isolation/browser matrix in a real allowed environment and record evidence.
3. Consolidate the CSS cascade component by component against that baseline.
4. Implement goals/reserve allocation with tested migrations, atomic allocations and backup support, then proceed in the published plan order.
