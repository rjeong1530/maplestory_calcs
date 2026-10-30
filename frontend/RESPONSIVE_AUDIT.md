# Maple Workshop responsive pass

Checked at 1440, 1200, 1024, 768, 480 and 375 CSS pixels in isolated Chrome.
The browser suite captures light/dark views of Home, Star Force, Flame, Potential,
Equipment Setup, equipment stats/upgrades and Bug Report at every width.

## Changes

- Shared 44px minimum button, select, text/number input and disclosure targets.
  Checkbox/radio labels provide the larger hit area without enlarging their glyphs.
- Potential requirement removal now has a 44px column; controls retain their values,
  validation and handlers. Long button text and headings can wrap.
- Equipment stats reserves enough space for five usable slot columns; the homepage
  preview stacks earlier to avoid squeezing its summary. Existing mobile single-column
  equipment/editor layout remains. Edge slot tooltips align inward on small screens.
- Flame uses setup/results columns at tablet widths, with fields stacked inside each;
  mobile remains single-column. SVG sizing stays proportional and small histogram
  labels are enlarged through a container query.
- Dropdown width is bounded and links can wrap. Shared dialogs constrain fields,
  scroll within the viewport and retain focus handling and dismissal behavior.
- Existing recommendation cards on mobile are retained and verified for Star Force,
  Potential, Flames and Overall. Desktop remains a table. Detailed Star Force
  rate/cost comparison tables keep their local scroll regions rather than losing
  columns or shrinking text to fit the page.
- Mobile recommendation captions use the full card width instead of an anonymous
  table-caption column that wrapped the title into a narrow strip.

## Automated checks

`npm run test:regression` includes:

- No page-level horizontal overflow at the six widths in both themes.
- Enabled buttons, selects, inputs and summaries have at least approximately 44px
  in both dimensions; checkbox/radio targets are measured using their labels.
- Calculator dropdown bounds at every page/width; modal bounds and internal width
  at every width with a 700px-high viewport.
- Populated recommendations in all four categories: table rows on desktop/tablet,
  stacked cards at 480/375px, no horizontal scrolling inside mobile cards.
- Existing functional, keyboard, navigation, state, storage and request-contract tests.

Screenshots and per-page target measurements are generated in `dist/ui-preview/`.
Production builds clear that directory. Visual spot checks supplement measurements;
browser emulation is not a substitute for testing every physical touch device.
Native select popups remain browser-managed. Histogram bars retain their existing
focusable data points rather than changing the chart data to force 44px-wide bins.

Implementation is presentation CSS in `src/ui/responsive.css`, loaded with the
shared UI styles. No business logic, API calls, saved formats or routes change.
