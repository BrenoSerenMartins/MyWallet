# Compact header, ledger and motion

The header keeps the logo, primary destinations, notification bell and one space/menu control. Space switching and secondary areas share the existing menu. Creating a manual entry is a page task rather than a permanent header CTA.

Page headers can place local view navigation next to their title. Overview and Planning no longer dedicate a separate full-width band to these choices. Planning retains visible period/edit actions; copying a prior month and selecting actual-account scope live in a native disclosure action menu. A non-default scope remains visible as a quiet badge. Action menus close on outside interaction/Escape and restore a visible focus target before opening a dialog.

## Ledger
Movement search, calendar-month presets and inclusive From/To dates are visible above the ledger. Advanced account/category/reconciliation controls use a separate dialog. Presets preserve independent filters; previous-month dates handle leap years and year boundaries. The API's exclusive end date is still calculated from the inclusive UI date. An inverted range is shown as a field error and does not issue a ledger query.

The desktop ledger is a native six-column table: date, movement, category, account, value and reconciliation status. Column headers remain available to assistive technology on mobile while rows use a compact responsive grid. Original amounts and dates are displayed unchanged. Descriptions open the existing detail panel; status buttons explain provenance/classification without opening that panel. Financial direction and source status are not flattened into a long repeated metadata sentence. Recent-movement rows use the same quieter metadata treatment.

The table sits directly on the page canvas with separators and a hover state; it has no enclosing card or persistent coloured body background. Active filter chips expose advanced constraints. Counts describe loaded rows, not an unrequested total.

## Continuity and motion
Previous rows remain visible while a new filter request runs, with an updating status and dimmed/inert table. Loading more is disabled while placeholder results belong to a prior filter, preventing cursor reuse. Page, menu and dialog entrances use short opacity/translation animations. Radix dialog presence supports fade/slide exits. Tab indicators move between the actual measured button bounds. No numeric count-up or per-row stagger changes financial readings. Motion preferences disable these effects for reduced-motion users.

Browser regressions cover compact action access/focus, period presets at month/year/leap boundaries, invalid ranges, responsive table columns/status/details and reduced motion. Browser execution remains subject to the current environment's Chromium/local-network restriction; discovery and compilation must not be reported as a browser pass. No database migration is needed.

Filter continuity has a browser regression that holds the next filter response pending, checks that prior rows remain visible but inert, and verifies that the prior filter cursor is not sent. Desktop/mobile table checks also assert a transparent workspace/table background. These browser scenarios are discoverable but have not executed in the restricted browser environment.
