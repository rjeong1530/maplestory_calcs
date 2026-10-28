# Frontend audit and UI migration plan

Audited 2026-10-28. This is a source-code audit, not a browser screenshot or live-service audit. No application code or business logic was changed. Baseline: `cd frontend && npm test` passed **92 tests, 0 failures**. Browser, deployed-service, build, and rendering benchmark suites were inspected where relevant but not executed for this audit.

## 1. Framework and structure

- React 19, React DOM 19, JavaScript/JSX, Vite 8, Tailwind CSS 4. Package manifest ranges: React `^19.2.8`, Vite `^8.3.0`, Tailwind `^4.3.3`.
- No React Router, Redux, Zustand, query library, component library, or animation library is declared. Routing and request lifecycle management are implemented locally.
- `frontend/src/main.jsx`: backend warm-up, initial route preloading, React StrictMode and root error boundary. Uses `createRoot`, not hydration.
- `App.jsx`: navigation, page metadata/content, route selection, and retained lazy pages.
- `components/`: page views, input editors, result tables, shared controls, and some embedded behavioral logic.
- `hooks/`: routing, metadata, equipment state, flame payloads, and keyed calculation requests.
- `data/`: catalog JSON, class/weapon mappings, validation, persistence, calculation helpers, request serialization, formatting, and public page content. This directory contains substantial business logic, not just static data.
- `api.js`: shared fetch wrapper.
- `index.css`: theme and global native-element styling; component styles mostly live in JSX utility classes.
- `public/`: icons, flame images, crawler files and verification asset.
- `tests/`: Node unit tests. `scripts/`: prerendering, browser regression, deployed smoke, rendering benchmarks, and equipment sample generation.
- `npm run build` runs Vite and then `scripts/prerender.mjs`. Public content is visible before interactive loading. Preserve route metadata, canonical URLs, crawler assets and this startup behavior.
- Backend contracts are in `backend/api/main.py` and `backend/api/bug_reports.py`.

## 2. Routes and feature ownership

Source: `src/data/routes.js`, `App.jsx`, `EquipmentPlanner.jsx`, `EquipmentPage.jsx`.

| URL | Page/component | Features to preserve |
| --- | --- | --- |
| `/` | `LandingPage` | Home content and navigation links |
| `/calculators/starforce` | `EquipmentPlanner` → `StarForceCalculator` | Custom estimate, per-star modes/safeguards, tap costs/rates, budgets, strategy comparison, custom strategies and application to equipment |
| `/calculators/flames` | `EquipmentPlanner` → `FlameCalculator` | Class/equipment/weapon configuration, score weights, probability, roll/meso budgets |
| `/calculators/potential` | `PotentialCalculator` | Option loading, supported target editing, probability and cube budgets |
| `/equipment` | `EquipmentPlanner` → `EquipmentPage` | Equipment setup; Stats & upgrades; item selection, equipped/second-copy stats, upgrade rankings and overall order |
| `/bug-report` | `BugReportPage` | Prepare/review, submit, copy and download report |

Equipment Setup and Equipment Upgrade Order are **not separate URL routes**. The latter lives beneath Stats & upgrades. Initial equipment view is Stats & upgrades if at least five user-selected items exist, excluding the fixed ring; otherwise Setup.

Routing uses `history.pushState` and `popstate`. It normalizes trailing slashes, `.html`, and `/index.html`. Unknown paths render a not-found panel. Ordinary left clicks navigate in-app and scroll to top; modifier clicks, download links and other targets retain browser behavior.

`DeferredPage` mounts on first visit and subsequently hides rather than unmounts. This retains inputs/results and permits existing requests to finish while hidden. Preserve that lifecycle across routes and equipment sections.

## 3. Shared components and dependencies

| Component/group | Current role and coupling |
| --- | --- |
| `Navigation`, `PageHeader`, `PageGuide` | Global navigation and public content; metadata has a separate hook |
| `DeferredPage`, `PageErrorBoundary`, `LoadingStatus` | Lazy loading, retention, error isolation and cold-start messaging |
| `EquipmentPlanner` | Shared state owner for equipment, flame and Star Force routes |
| `EquipmentGrid`, exported `EquipmentIcon` | Setup/stats equipment visualization, active slot selection, fixed slots and image failure handling |
| `EquipmentWindow` | Setup picker, class/family selection, draft save/discard and JSON transfer |
| `EquipmentStats`, `EquipmentAnalysis`, `EquipmentLaddering` | Current item editing, obtainable options, second-copy and transfer configuration |
| `EquipmentStrategyApply` | Apply selected strategy to all/group/selected eligible equipment |
| `CalculatorForm`, `TargetRow` | Potential form and target rows; include filtering, validation and payload behavior |
| `Results`, `RollBudget`, `StarForceBudget` | Potential results and budget interaction; `RollBudget` is shared with Flames; budget math differs between independent rolls and Star Force |
| `EquipmentUpgradePlan`, `FlameUpgradeOrder`, `OverallUpgradeOrder` | Planner request and multiple result presentations |
| `StarForceStrategies` | Request lifecycle, custom strategy creation, sorting, comparison chart, selection and application |

`SuccessChances.jsx` also exists, but no importing caller was found in `src`; it is not part of the active component tree. The separate `data/successChances.js` constants are used by Star Force.

## 4. API calls by page

All application JSON requests use `apiRequest`. Development proxies `/api` to `http://127.0.0.1:8000`. `VITE_API_BASE_URL` overrides the base; production otherwise uses `https://maplestory-calcs-1.onrender.com`.

| Caller/page | Request | Purpose |
| --- | --- | --- |
| Startup, every initial URL | GET `/api/health`, `cache: no-store` | Wake backend; failure intentionally ignored; runs outside StrictMode |
| Home | No page-specific JSON request | Navigation/content only |
| Potential | GET `/api/options` | Equipment types, levels, cube types, supported effects |
| Potential form | GET `/api/item-options?potential_equipment_type=…&level=…&cube_type=…` | Obtainable effects; prune unsupported target rows |
| Potential | POST `/api/probability` | Joint probability for all targets |
| Flame | POST `/api/flame-probability` | Score threshold probability |
| Star Force | GET `/api/starforce-costs?level=…&shining_starforce_sunday=…&mvp_rank=…&superior_item=…` | Per-star costs/rates; 250 ms typing debounce |
| Star Force estimate/custom strategies | POST `/api/starforce-estimate` | Estimate and optional budget distribution |
| Star Force comparisons | POST `/api/starforce-strategies` | Frontier and comparison scenarios |
| Equipment Setup | No selection API | Bundled catalog filtering plus external image requests |
| Equipment stats | GET `/api/item-options` | Level, black cube, boss flag, optional potential/flame equipment types and weapon offense parameters |
| Equipment Upgrade Order | POST `/api/equipment-upgrade-plan` | Category rankings, flame rankings, overall steps |
| Bug Report | POST `/api/bug-reports` | Entered fields plus `request_id`; response includes `report_id` |

Item icons are loaded from `https://maplestory.io/api/{region}/{version}/item/{id}/icon`, using catalog metadata. These are image requests outside `apiRequest`. Catalog selection itself works from local JSON, not a live catalog API.

The shared wrapper has a 90-second timeout, combines caller cancellation with timeout, parses JSON, surfaces backend validation `detail`, and maps connection/timeout/non-JSON/overload errors. It does **not** automatically retry calculations. Preserve payloads, query parameters, timeout, request timing and retry semantics.

## 5. State management

- React component state, refs, effects and memoization; props/callbacks connect views. No global state provider.
- `useEquipmentPlanner` owns committed equipment/class, setup draft, active slot, separate flame-calculator form/weights, equipment scoring weights, upgrade settings, storage errors and save confirmation.
- Selecting/removing equipment, changing setup class and importing files create a **draft**. Save commits it; Discard abandons it. Import does not immediately overwrite saved equipment.
- Saving an ordinary draft preserves stats edited elsewhere for unchanged item IDs; imported drafts supply their own stats. Saving is confirmed only after storage succeeds.
- Current stats, equipment weights, strategy application and upgrade settings update committed state and trigger persistence. Do not impose setup's explicit-save behavior on these editors.
- Flame calculator class/weights and equipment class/weights are distinct. They must not be merged during UI consolidation.
- `useCalculationRequest` binds results to `JSON.stringify(form)`, aborts superseded requests, and suppresses aborted responses. Star Force strategy and equipment-plan components implement similar keyed logic themselves.
- Potential uses its own busy/result/error state and disables form editing during calculation. It does not use the common keyed request hook; a visual migration must not silently rewrite this lifecycle.
- UI-only state includes tab selection, sorting, target row IDs, selected custom strategy, collapsed stats, equipped/second-copy view, import/copy status and image failures.

## 6. Browser storage and saved builds

Source: `data/equipmentStorage.js`, `equipmentSave.js`, `hooks/useEquipmentPlanner.js`.

- One localStorage key: **`maplestory-flame-equipment`**.
- Fields: `maple_class`, `equipment_class`, serialized `equipment`, `score_weights`, `equipment_score_weights`, `upgrade_settings`.
- Read localStorage first; recover an old cookie of the same name if necessary. Retire the cookie only after a successful localStorage write.
- Malformed stored data is restored defensively; storage failures produce an export-before-closing warning.
- No sessionStorage usage found. No named-build collection or server build-save API was found: there is one persisted setup, with portable JSON exports/imports.
- Full calculator forms/results, budget controls, active views, custom strategy lists and unsaved setup drafts are not persisted. Navigation retention is not reload persistence.
- Export format: `{ format: 'maplestory-equipment', version: 1, equipment_class, equipment, score_weights? }`; weights are grouped into `flame` and `potential`.
- Imports accept UTF-8 BOM, validate format/version, class compatibility, slots, lines and settings, and reject files over 1 MB in the UI. Export includes the setup preview, including pending draft choices.

## 7. Equipment structures and invariants

The catalog records use `itemid`, `name`, `slot`, `class`, `level`, `equipment_type`, `boss_reward` and optional item-specific metadata. `flameEquipment.js` transforms these into picker/runtime objects.

Runtime equipment is a map keyed by slot (`weapon`, `hat`, `ring-1`, `pendant-2`, etc.). Items include:

```text
id, name, slot, icon, color, config
config: equipment_level, equipment_type, boss_equipment,
        optional weapon offense configuration
currentStarForce, currentPotential, currentFlames,
currentFlameType, currentBossEquipment,
starForceModes, starForceSafeguards, maxStarForce,
replacementCostMesos, minimumCooldownSeconds, laddering
```

Potential lines are `{ effect, value }`, maximum three; flame lines are `{ option, stage }`, maximum four distinct options. Partially filled editor rows can persist; request serialization removes incomplete rows and converts numeric values.

Persistence uses snake_case (`current_star_force`, `current_potential`, `mode_by_star`, etc.), retaining item ID and editable settings rather than trusting arbitrary imported catalog metadata. Restoration rebuilds items from the catalog.

Laddering contains starting threshold, legacy minimum-score fields, optional `second_copy` and transfer configuration. Second-copy stats are distinct from equipped stats. Request construction resets legacy manual minima so the backend computes stopping scores. Transfer settings include donor stars/target/cost, tier-up cost and trace restoration.

Important invariants:

- Ring 4 is fixed Ring of Restraint, excluded from editable enhancement calculations, serialized equipment and upgrade requests; restoration supplies it automatically.
- Android is excluded from editable setup/import equipment.
- Class/job/weapon compatibility, overall-versus-bottom conflicts and duplicate-slot rules are handled in the data helpers.
- Item-specific star caps, unsupported enhancement types, Astra secondary exceptions, and Source of Suffering transfer rules must remain unchanged.
- The editor key includes slot, item ID and second-copy mode. Changing it can leak or reset item-local state.

## 8. Calculator input/output contracts

| Feature | Request/input structure | Response/display structure |
| --- | --- | --- |
| Potential | `equipment_type`, numeric `level`, `cube_type`, `targets: [{effect,target}]`, `percentiles: []` | `probability`, `percentage`, nullable `one_in`, `cube_estimates`; frontend attaches cube type/sale for budget pricing |
| Flames | `{config, target_score}`; config includes equipment level/type, boss/flame type, main/secondary/offense stats, score weights and weapon configuration where applicable | `target_score`, `probability`, `percentage`, nullable `one_in`; local roll/meso budget calculations |
| Star Force estimate | Item level, start/target stars, replacement mesos, event/MVP/Superior flags, numeric modes by star, safeguard booleans, success percentiles, `include_budget_distribution: true` | Expected cost/replacement cost/attempts/booms, attempt/meso estimates, optional budget distribution |
| Star Force strategies | Item level, start/target, replacement mesos | `efficient_frontier`, `scenarios` and strategy metrics/modes/safeguards; custom estimates become local comparison rows |
| Equipment plan | `include_overall`, derived `laddering_enabled`, categories, class stats, cube/sale/event/MVP settings, flame/potential weights, serialized equipment array | Category `rankings` with `gain_per_meso_first` and `unavailable`, `flame_rankings` by flame type, `overall_upgrade_order` with steps; separate standard category and combined laddering presentations |
| Bug report | Area, summary, steps, expected, actual, optional environment/contact, stable UUID `request_id` | `report_id` shown as submission reference |

Star Force budget distribution includes `step_mesos`, `probabilities`, `mean_success_probability`, `rounding_unit_mesos`, `calculation_limit_mesos`. Keep its CDF lookup/rounding separate from independent-roll probability math in `rollBudget.js`.

Equipment request rows include name/slot, level/type, potential type, current stars, optional laddering/cap, cooldown floor, replacement mesos, modes/safeguards, boss flag, weapon offense and current potential/flame lines. `buildUpgradeRequest` is the authoritative mapping.

Behavior that looks presentational but is mathematical:

- Potential All Stat targets expand into four combined stat totals before submission. `cube_sale` is removed from the probability payload and used locally for cost estimates.
- Flame class selection determines main/secondary/offense stats and valid weapons. Weapon configuration can override the displayed equipment level.
- Strategy comparison currently assumes Shining on, MVP none and standard equipment; custom requests explicitly preserve those assumptions. Do not inherit unrelated custom-estimate toggles while combining forms.
- Upgrade rows are ordered/grouped by helpers; Star Force category display slices to 20 grouped rows. Preserve ordering and meaning of ranks.
- Probability zero, probability one, null/unavailable values, confidence levels, and budget horizons have explicit handling. Zero must not become a blank or unavailable value.
- Flame stopping target and average successful result are different quantities. Keep their labels and explanatory text distinct.

## 9. Loading states

- Startup/preload and lazy route Suspense fallback: `LoadingStatus`.
- Potential: initial options, item-specific obtainable lines, calculation status and disabled fieldset.
- Flames/Star Force: calculation status, disabled controls, result panels with busy/live semantics; Star Force separately loads debounced costs/rates.
- Strategies: separate comparison and custom-strategy request states.
- Equipment: per-item option loading, plan loading, file import state; setup busy includes flame calculation busy through shared planner props.
- Bug reports: submission pending state, disabled editor/submit, duplicate-send guard.
- Empty results, no available options, no selected equipment and no eligible upgrades are distinct from loading.

Keep cold-start messaging and real request-driven completion; skeletons must not hide an actionable error or imply a failed request is still running.

## 10. Errors and validation

- Root and deferred-page error boundaries show reload recovery; reload can lose unsaved inputs.
- API errors appear inline, usually with `role="alert"`; Potential offers explicit retries for initial options and obtainable lines. Other flows generally retry through their normal action or a changed input rather than a uniform retry component.
- Equipment import/export, persistence and clipboard failures have separate messages. Icon components fall back when remote images fail.
- Native `required`, `type`, `min`, `max`, `step`, `pattern`, `maxLength`, disabled fieldsets and read-only inputs are part of validation.
- Additional validation/filtering lives in event handlers and data helpers: target deduplication/availability, star clamping, line limits, valid flame stages, compatible items and strict import validation.
- Backend Pydantic models validate numeric types/ranges, enums, finite values and cross-field constraints. Preserve existing frontend serialization so it continues to satisfy those models.
- Bug reports require preparation/review before sending, reuse the request UUID on retry, and prevent duplicate submissions. Editing clears prepared/submission state.

## 11. Animations and interaction effects

No animation library, keyframe animation or Tailwind `animate-*` usage was found in `src`. Existing motion is limited to 150 ms background/text/border transitions on Star Force view buttons, upgrade tabs and the equipment approach link. The stats disclosure arrow changes rotation with expanded state. No explicit reduced-motion rule was found.

Navigation uses native `details/summary`, mouse hover, outside pointer dismissal, blur dismissal, Escape and focus return. These are functional interactions, not just dropdown styling.

## 12. Responsive behavior

- Global body minimum width 320 px; centered main maximum width 1160 px. Main padding changes at 480 px.
- Calculator input/result columns collapse at 850 px.
- Equipment setup/stats layouts collapse at 720 px; setup preview moves before picker content.
- Equipment slots remain a five-column spatial grid with tighter mobile gaps and labels.
- Item analysis uses a 640 px **container query**, not a viewport breakpoint.
- Additional local thresholds exist at 480, 520, 540, 640, 760 and 800 px for controls, content and rankings.
- Wide result/rate tables retain minimum widths with horizontal scroll; some have bounded vertical scroll and sticky headers. Several scroll regions are keyboard-focusable.
- Inputs use `min-w-0`, rows wrap, and large values use tabular numerals/overflow wrapping.

These findings describe source rules; actual clipping, touch usability and visual quality still require browser verification during implementation.

## 13. CSS/Tailwind configuration

`vite.config.js` registers React and `@tailwindcss/vite`. There is no separate Tailwind JS configuration in the frontend inventory.

`index.css` declares theme/base/components/utilities layers, imports Tailwind theme and utilities, and scans `./` with `@source`. It deliberately **does not import Preflight**, retaining native heading/list/form defaults.

Theme tokens: maple `#e5b567`, ink `#191918`, surface `#222220`, rule `#41413a`, muted `#b3b1a6`; Segoe UI sans and Consolas monospace stacks. Global dark color scheme, native element styles and visible focus outlines are defined in the base layer.

Most page styling uses long Tailwind utility strings, arbitrary descendant selectors/media queries, hard-coded colors and semantic class hooks. Some hooks are used by browser regression tests. Strategy chart colors intentionally use complete class strings so the Tailwind scanner retains them.

## Migration boundaries

### Business logic: leave untouched

- Backend code and API models/endpoints.
- `api.js`, request cancellation/keys/timeouts and debounce behavior.
- `data/` calculation, compatibility, normalization, serialization, persistence, ranking, pricing and budget helpers; bundled catalog and metadata.
- Hooks and component state ownership, effect dependencies, retained mounting, keys and event-handler behavior.
- Defaults, input names/types/options/constraints, disabled/read-only rules, payload construction and output precision/units.
- Storage key/schema, cookie migration, draft/commit semantics, import/export version and validation.
- Navigation URLs/history/link behavior, lazy boundaries, metadata and prerender behavior.

Some of this logic is embedded in `.jsx` files. Mark those blocks as protected; a component file is not automatically safe to rewrite because it renders UI.

### Components that can be restyled in place

Home, public headers/guides, navigation, calculator shells, existing form controls, target rows, result panels, budget layouts, equipment grid/picker/editor, strategy chart/table, upgrade tables, bug report form and status/error panels. Change classes and presentation wrappers while preserving callbacks, keys, props, DOM semantics and visibility behavior.

### Presentation implementations to replace incrementally

No full page controller needs replacement. Replace duplicated panel/heading/button/status markup and repeated table-scroll wrappers with small presentational components. Replace repeated tab-switch styling while retaining existing mounted panels and pressed/controls semantics. Consolidate duplicate item-icon presentation only while retaining each fallback behavior.

Do not replace native selects with a custom combobox, tables with virtualized lists, or navigation with a new router as part of the initial visual migration. Those are independent interaction changes requiring their own acceptance checks.

### Components that should become reusable

Candidates: `Panel`, `SectionHeading`, `Button`, `FormField`, `CheckboxField`, `ViewSwitch`, `StatusMessage`, `EmptyState`, `Metric`, `ScrollableTable`, and shared equipment-icon presentation.

Keep these controlled and presentational: accept existing values/callbacks, forward native attributes and refs where needed, and own no domain conversions or requests. Retain `RollBudget` and `StarForceBudget` as distinct domain components even if they share visual primitives. Avoid a generic calculator controller or schema-driven form engine in this phase.

## Highest-risk redesign changes

| Risk | Accidental regression | Required preservation/check |
| --- | --- | --- |
| Route/tab remounts or CSS overriding `hidden` | Lost state, duplicate requests, hidden forms exposed | Navigate away/back during requests; preserve visited-page mounting and hidden semantics |
| Moving state into new components | Inputs/results reset when layouts change | Stable component identity and keys; resize with populated forms |
| Equipment picker replacement | Draft immediately overwrites saved equipment | Select/import → preview → discard/save → reload checks |
| Class/weight consolidation | Equipment and flame scoring influence each other | Separate state, storage fields and request snapshots |
| Item identity/copy view changes | Stats written to wrong slot or equipped copy | Switch slots, same item, different item and second-copy mode |
| Custom form controls | Missing validation, changed numeric coercion, accidental form submits | Preserve native attributes, button types and empty-string behavior |
| Async UI simplification | Stale results displayed for new inputs | Delayed/reordered responses, cancellation and retries |
| Ranking/table redesign | Sorting/grouping, selected strategy or gain/cost meaning changes | Compare ordered rows, selection and exact displayed units |
| Budget visualization | CDF replaced by independent-roll formula; zero/null confused | Impossible/guaranteed cases, bounds and confidence round-trips |
| New global CSS reset | Hidden content, forms, focus, details and lists change | Keep Preflight decision; keyboard/mobile checks |
| Bug report flow simplification | Submission before review or duplicate reports | Prepare/edit/retry/copy/download with stable request ID |
| Renaming styling hooks | Browser tests stop finding controls | Review selectors explicitly; do not delete assertions to make tests pass |
| Removing “extra” text/columns | Users confuse expected outcome with stopping threshold | Preserve calculation assumptions and result explanations |

## Recommended implementation order

1. **Capture the behavioral baseline.** Keep this audit, record representative inputs/payloads/results, and run existing unit, browser, build/prerender checks before visual changes. Capture desktop/mobile screenshots, including loading/error/empty states. Existing browser regression suite needs Firefox/geckodriver and uses an isolated profile; deployed smoke tests require their configured environment.
2. **Introduce visual tokens and minimal presentation primitives.** Preserve global native-element behavior, focus outlines and `hidden`; avoid broad resets. Adopt primitives one at a time.
3. **Restyle Home and public page framing.** Then navigation, preserving link/history/dropdown/focus behavior, metadata and lazy loading.
4. **Restyle Potential.** Exercise option loading/filtering, all-stat expansion, add/remove targets, retry and all probability/budget edge cases. This establishes the calculator layout pattern.
5. **Restyle Flame.** Reuse the presentation pattern; verify class/weapon changes, weights, level overrides, stale-result invalidation and separate equipment settings.
6. **Restyle Star Force custom estimate and tables.** Verify per-star modes/safeguards, event/MVP/Superior settings, cost debounce and budget distribution output.
7. **Restyle Star Force strategies.** Preserve fixed scenario assumptions, chart selection, sorting, custom strategy lifecycle and applying to equipment scopes.
8. **Restyle Equipment Setup and item selection.** Verify compatibility/conflicts/fixed ring, preview/save/discard, import/export, storage failures and refresh restoration.
9. **Restyle equipment stats and laddering.** Verify equipped versus second-copy editing, options, roll limits, caps, cooldown and transfer behavior.
10. **Restyle Equipment Upgrade Order.** Preserve category selections, grouped rankings, flame confidence displays, overall order, thresholds, empty/error states and table accessibility.
11. **Restyle Bug Report.** Preserve review-before-submit, UUID reuse, duplicate guard, validation and copy/download fallbacks. Test submission with mocks or an isolated test backend, not by sending an unsolicited production report.
12. **Run the migration acceptance pass.** Repeat relevant existing tests, build/prerender checks and responsive/keyboard checks; compare API request snapshots, result values, saved/exported schemas and navigation retention. Run rendering benchmarks after layout work to catch regressions. Keep fixes to pre-existing behavioral issues in separately scoped changes.

Completion criterion: the same actions and inputs produce the same requests, persisted data, validation outcomes and mathematical outputs, while only presentation changes. No redesign implementation is included in this audit.
