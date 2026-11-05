# Topbar and provisional identity

The desktop header uses three grid tracks: equal flexible side tracks around the navigation's intrinsic width. The brand sits on the left, navigation is centered against the header itself, and notifications/workspace controls sit on the right. Side controls are constrained to their available track. The mobile header uses two tracks and preserves the bottom navigation.

Desktop links pair existing Lucide destination icons with labels and a soft active surface. Keyboard focus retains an explicit 2px ring. At 1051–1199px, labels are hidden visually to keep controls from overflowing; accessible names and focus/hover tooltips remain available.

The brand is temporarily text-only while a new short abstract name is selected. The rejected W/wallet artwork is removed, including its service-worker cache entry; installation icons use the earlier simple wallet artwork as a temporary fallback. No new product name or definitive brand asset is applied without selection.

`topbar.css` owns the lockup and header presentation. Route, privacy, theme, notification and financial behavior remain unchanged. Motion respects reduced-motion settings. No database changes are required. Production compilation and lint validate the change; local browser execution remains blocked by the environment, so the responsive appearance still needs a browser pass.
