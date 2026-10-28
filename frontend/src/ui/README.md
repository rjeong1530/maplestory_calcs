# Maple Workshop UI

Presentational React components. The live app now uses AppShell and Navbar;
calculator interiors, route paths, business hooks, API requests and persistence
remain unchanged. Import from `src/ui/index.js` under an `AppShell` (or a
`.mw-theme` ancestor) when migrating individual pages in a later change.
Keep the existing `src/index.css` import: it supplies Tailwind's utility output.

## Review the components

Run `npm run dev:design-system` in `frontend`, then open
`http://127.0.0.1:5173/design-system.html` (use the port Vite prints if occupied).
The preview is a separate HTML entry, not a new application route, and makes no
API or storage calls. `npm run build:design-system` checks the standalone entry
and writes `dist/design-system`; normal production builds still use `index.html`.

`npm run test:design-system` runs headless Chrome with an isolated temporary
profile (set `CHROME_BINARY` if Chrome is not at the default Windows path). It
checks native validation, bounded stepping, retained tab panels, keyboard tabs,
dialog focus/Escape/restoration, tooltip and toast dismissal, reduced motion,
responsive column counts and horizontal overflow at 1440/900/390/320 px. It also
asserts no calculator API calls or localStorage writes in the component preview.
It then checks the real app with mocked APIs: all six routes, back/forward,
rapid navigation, retained calculator inputs, dropdown Escape/focus behavior,
mobile disclosure and reduced-motion transitions. Screenshots are saved to
the ignored `dist/ui-preview/` directory. Production builds clear `dist`, so run
this check after a production build when reviewing screenshots.

## Tokens and styling

`workshop.css` scopes colors, typography, spacing, radii, shadows and motion tokens
to `.mw-theme`. The old dark tokens are intentionally unchanged. The supplied
`examples/bg.png` is copied to `public/images/workshop/floating-islands.png` and is
the shell's default decorative background. Pass `backgroundImage={null}` to omit
it or a URL to override it. No new art was generated.

The fixed decorative background has no pointer events and is outside the page
transition. It stays static (no scroll listener or parallax work). `PageTransition`
fades outgoing content for 100 ms, then enters from opacity 0/y 8 over 250 ms.
Reduced motion is immediate. The page tree has no route key: shared planner and
visited DeferredPage children stay mounted. Navbar stays interactive throughout.
Guides and About are in-page anchors, not new routes. There are no search,
settings or account controls because the app does not support those features.
Legacy calculator content retains its dark colors inside `.mw-legacy-page` until
the individual page migration. The existing static prerender fallback is retained.

## Star Force page migration

The custom-estimate view now uses the light Workshop panels. Its controller in
`StarForceCalculator.jsx` retains the original initial state, effects, request
keys/debounce, event handlers and submit payload. `StarForceEstimateView.jsx`
contains presentation only; both estimator/strategy views remain mounted.
The separate Compare strategies view and guide keep their existing presentation.

The standalone estimator does not bind a named equipment item or rarity, so its
summary says Custom equipment and displays only the entered level and existing
Standard/Superior flag. Modes retain their real names (Mode 1–4), with three
choices at 15–17 and four at 18–21. No Star Catch or combined safeguard preset
was introduced. Stepper callbacks forward strings to the unchanged handler and
retain original min/max/step/required constraints.

The results display existing API metrics, including expected attempts and success
chance **at the average cost**. The chart plots `budget_distribution.probabilities`
as an unsmoothed step CDF against `index * step_mesos`. It is omitted without a
distribution. `StarForceBudget` and its conservative lookup math are unchanged.
`AnimatedNumber` interpolates only aria-hidden text for 250 ms; the accessible
value is the exact result immediately. Previous numbers live only in a visual
ref, not calculator state. Reduced motion shows exact values immediately.

The browser suite checks the exact submitted payload after changing steppers,
per-star mode, safeguard, event, MVP, Superior and replacement cost; validation,
busy/error/result states, CDF budget lookup, absent-CDF behavior, view retention,
and viewport overflow. Star Force screenshots use mocked results, not live odds.

## Loading system

`loading.jsx` provides presentation only; mount it from an existing async flag or
Suspense fallback. It owns no requests, timeouts, minimum durations or result state.
The existing `LoadingStatus` now delegates to this system, retaining service
cold-start guidance for API work and omitting it for local code/file loading.

| Component | Integration |
| --- | --- |
| `FullPageLoadingScreen` | Initial route-module preload when no prerender content exists. Logo, sky, six lightweight decorative CSS particles and readable status. Existing prerender guides stay visible when available. |
| `CalculatorLoadingOverlay` | Controlled `loading`, optional `children`, `label`, `variant="result"` or `"equipment"`. With children, retains them under a translucent layer; without children, renders a result skeleton only while busy. Does not disable underlying controls: the caller retains its existing disabled rules. |
| `SkeletonCard` | Generic option/module fallback. `decorative` suppresses duplicate status semantics when a parent already announces loading. |
| `SkeletonTable` | Tap costs/rates, strategy search and upgrade-order requests. Optional `rows`, `columns`, `label`, `service`. |
| `EquipmentGridSkeleton` | Five-column equipment slots during equipment lazy loading and JSON file reading. No skeleton on an empty but already-loaded equipment set. |
| `ResultSkeleton` | Pending calculator output with metric placeholders, a readable label and optional service guidance. |
| `LoadingButtonContent` | `busy`, optional `label`, idle `children`. Renders a spinner inside existing buttons; callers preserve their disabled expressions. |
| `LoadingPlaceholder` | Internal shared card/table/equipment/result dispatcher. |

Calculator input forms remain mounted. Existing request hooks retain their exact
result clearing behavior. JSON import retains the equipment grid underneath its
overlay until the file read completes. Error/empty states are not loading states.
Shimmer, particles and spinners stop under `prefers-reduced-motion`, while status
text remains visible. Browser tests hold actual fetch/module requests and check
loading, completion, error recovery and reduced motion; delays exist only in the
test harness, never in application request handling.

The requested base colors are preserved. Additional darker ink variants support
readable small text on pastel surfaces; primary buttons use the darker blue with
white text. Rarity colors are blue/Rare, violet/Epic, gold/Unique, green/Legendary,
with corresponding pastel backgrounds and explicit text labels.

Shared styles live here, not in individual pages. Layout uses Tailwind utilities;
complex component states and animations use scoped CSS. Complete class names
keep Tailwind scanning reliable. No Preflight reset was added.

## Component contracts

| Component | Key props / behavior |
| --- | --- |
| `AppShell` | `navbar`, `children`, optional `backgroundImage`. Supplies one main landmark, skip link, theme, centered width and MotionConfig. Do not nest inside another main. |
| `Navbar` | `links: [{href,label,active,onClick}]`, `brandHref`, `onBrandClick`, `actions`. Caller owns routing; native links keep modifier-click behavior. |
| `PageHeader` | `title`, `description`, `eyebrow`, `icon`, `actions`. One h1. Separate from existing public PageHeader. |
| `SectionHeader` | `title`, `description`, `action`, optional `id` on h2. |
| `ContentCard` | `children`, optional `hover`; native section/motion props. Hover elevation is opt-in. |
| `CalculatorPanel` | `title`, `description`, children. Does not create a form or fieldset. |
| `ResultCard` | `title`, `busy`, children. Polite live region; caller chooses loading/error/empty/result content. |
| `StatCard` | `label`, preformatted `value`, `unit`, `hint`. Animates text replacement without interpolating or rounding results. |
| `CalculatorGrid` | `columns={2 or 3}`. Single column mobile, two at 768 px, optional three at 1280 px. Put inputs before results in DOM order. |
| `PrimaryButton`, `SecondaryButton`, `DangerButton` | Native button props/ref. Default `type="button"`; explicitly use `type="submit"` for form submission. |
| `InputField` | Native input props/ref, `label`, `hint`, `error`, `multiline`. No parsing or validation policy. |
| `SelectField` | Native select props/ref and option/optgroup children, label/hint/error. No option filtering. |
| `NumberStepper` | Controlled `value` string and `onValueChange(string)`, label and native constraints. Preserves empty strings; native stepping respects min/max/step. `step="any"` allows typing but disables step buttons. Caller owns conversion/validation. |
| `Toggle` | Native controlled checkbox props and `label`, rendered as a switch. `onChange` receives the native React change event. |
| `Tabs` | `label`, `tabs: [{value,label,content,disabled?}]`, `value`, `onChange(value)`. Arrow/Home/End keyboard navigation; panels stay mounted and inactive panels are hidden. Caller supplies a valid active value. |
| `SegmentedControl` | `label`, `options: [{value,label,disabled?}]`, `value`, `onChange(value)`, `disabled`. Pressed-button group, not tabs. |
| `Tooltip` | `content`, noninteractive children. Focusable trigger wrapper, hover/focus display, Escape dismissal. Do not put required instructions only in a tooltip. |
| `ItemCard` | `name`, `image`, `rarity`, `detail`, children. Read-only presentation; no equipment model assumptions. |
| `EquipmentSlot` | `label` (accessible name), `image`, `rarity`, `selected`, `disabled`, `onClick`. Caller enforces eligibility/fixed slots. |
| `RarityBadge` | `rarity`: Rare/Epic/Unique/Legendary. Text and color convey rarity. |
| `LoadingSpinner`, `SkeletonCard` | Optional `label`; readable status remains with reduced motion. |
| `EmptyState` | `title`, `description`, `icon`, `action`. No implicit request or behavior. |
| `ErrorState` | `title`, `message`, optional `onRetry`, `retryLabel`. Never retries automatically. |
| `Modal` | `open`, `onClose`, `title`, `description`, `children`, `actions`. Keep mounted; native dialog traps focus and restores trigger focus, Escape/backdrop request close. |
| `Toast` | `open`, `onDismiss`, `children`, optional `tone="error"`. Status/alert announcement and explicit dismissal; no timer that could hide errors. |

React 19 ref-as-prop works for native fields and button wrappers. NumberStepper
owns its input ref for native stepping. Modal/Toast are rendered inside the theme,
not in an unthemed body portal. Modal uses the browser top layer.

## Integration guardrails

- Adopt components without moving business state or replacing request hooks.
- Preserve existing field names, required/min/max/step/readOnly/disabled attributes,
  value types, handlers, form nesting and button types.
- Keep existing `DeferredPage` boundaries and item keys. Do not key pages by active
  tabs or wrap stateful forms in exit animations.
- NumberStepper is opt-in: adapt its string callback explicitly; do not silently
  replace existing event-based handlers.
- `.mw-actions` wraps action rows and makes their buttons full width on mobile.
  Fields fill available width; cards stack through `CalculatorGrid`.
- Loading and error text comes from existing logic when pages adopt these views.
- Do not copy the mockups' example options/calculations into domain code.

Framer Motion supplies brief entrance, hover/press, selected-tab, dialog, tooltip
and result-text transitions. `useReducedMotion` disables positional animation and
sets duration to zero; CSS's reduced-motion query disables spinner/shimmer and
transitions. See the official [reduced-motion guide](https://motion.dev/docs/react-use-reduced-motion).
