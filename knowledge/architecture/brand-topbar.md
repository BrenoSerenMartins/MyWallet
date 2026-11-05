# Brand and topbar

`app/public/brand-mark.svg` is the brand artwork: a folded wallet with a W monogram and a closure. The shared Logo uses this SVG with a separate text wordmark. The image is decorative; the text or home link supplies the accessible name. The mint/forest artwork stays consistent in both themes. `icon.svg` mirrors the mark; the 192px and 512px app icons have opaque backgrounds for maskable installation.

The desktop navigation pairs existing Lucide destination icons with labels and uses a soft surface for the active destination. A single hairline separates the brand from navigation. Keyboard focus retains an explicit 2px ring. At 1051–1199px, labels are hidden visually to keep controls from overflowing; accessible names and focus/hover tooltips remain available. Smaller layouts continue to use the existing bottom navigation rather than adding a second row of header links. The workspace menu and notification bell retain their existing behavior.

`topbar.css` owns the lockup and header presentation. Existing route, privacy, theme, notification and financial behavior remain unchanged. Motion respects reduced-motion settings. No database changes are required. Production compilation and lint validate the change; local browser execution remains blocked by the environment, so the responsive appearance still needs a browser pass.
