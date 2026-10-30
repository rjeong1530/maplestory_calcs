# Final Maple Workshop functional parity audit

Baseline: **c533aeb**, the last implementation before the Workshop theme commits.
Compared with the working tree on **2026-10-29**, including uncommitted changes.

**Outcome:** one confirmed migration regression found and fixed: animated removal
of an invalid Potential target temporarily blocked submission. No other unintended
functional differences were found in the reviewed source and tested workflows.
This is a source/contract audit plus automated verification, not a claim that every
possible input or production-service condition has been exhaustively tested.

## Evidence and scope

- Compared historical controllers with the extracted presentation components,
  including field constraints, handlers, conditional controls and rendered results.
- `git diff c533aeb -- frontend/src/data frontend/src/hooks frontend/src/api.js backend/calc`
  is empty: request conversion, defaults in shared data/hooks, scoring, sorting,
  persistence, API transport and backend calculation engines are unchanged.
- Reviewed the changed controller bodies: Star Force, Flame, Potential, equipment
  setup, upgrade plan and bug report retain their request/state logic. The explicit
  save-and-open action described below is the equipment-navigation exception.
- Independent literal contract fixtures in `tests/fixtures/preMigrationContracts.js`
  check old payloads, URLs and saves rather than deriving expected values from the
  current request builders.
- `npm run test:regression`: **104 passing tests**, including real React workflows
  in isolated Chrome with mocked API responses and existing domain tests.
- `python -m unittest backend.tests.test_api backend.tests.test_flame_histogram`:
  **27 passing tests** using local API integration, including Flame response
  probabilities compared with the unchanged engine and histogram probability mass.
- Production build, lint and public-page prerender verification are run separately.

Checkboxes below mean compared and preserved after the fix. They combine source
inspection with the coverage documented in `REGRESSION_TESTS.md`; they do not imply
that every listed control has a dedicated browser test.

## Explicitly approved exceptions to strict historical parity

These must not be misrepresented as visual-only changes or reverted as regressions:

1. **Flame response extension:** the user explicitly approved exposing the existing
   distribution. `/api/flame-probability` adds `score_distribution`; its request and
   original response fields remain compatible. The threshold calculation still uses
   the same unrounded distribution, `score >= target`, `fsum`, and probability clamp.
   The engine is unchanged. Older responses without bins still render the original
   results and a distribution-unavailable message. Strict response-shape identity
   with c533aeb therefore has this known, authorized exception.
2. **Save equips & edit stats:** explicitly requested to save the current draft before
   opening stats. The shared open-stats action now waits for successful persistence;
   storage failure keeps setup open. The ordinary Stats & upgrades navigation tab
   remains available without saving. Schema and persistence helpers are unchanged.
3. **Guides navbar removal:** explicitly requested; guide content remains below pages.
   Guides never had a separate route in the old route map.

All other observed migration differences are classified below as
**INTENTIONAL VISUAL CHANGE** or **FUNCTIONAL REGRESSION**.

## Star Force Calculator — `/calculators/starforce`

- [x] Inputs: level, replacement cost, current/target stars, modes for 15–21,
  safeguards for 15–17, Shining Sunday, MVP rank and Superior item retained.
  Compare strategies, custom strategies and budget controls remain available.
- [x] Defaults: level 200, stars 15→22, replacement 0, Shining on, MVP none,
  Superior off, all modes 1 and safeguards off.
- [x] Validation: required level 1–300 integer; current 0–29 integer; target at
  least current+1 through 30; nonnegative replacement up to 10^15, fractional
  replacement allowed. Same mode availability and safeguard ranges.
- [x] Payloads: exact estimate JSON, percentile list and distribution request flag;
  unchanged cost-query parameters and strategy endpoint/controller behavior.
- [x] Calculations: mode/safeguard/event/MVP handling, request conversions, budget
  lookups and strategy helpers unchanged. No new success calculation in charts.
- [x] Result values: total/replacement mesos and booms retain formatting and source
  values. Extra cards expose existing attempts/mean-budget success fields only when
  finite; the CDF plots returned samples. Budget interface remains intact.
- [x] Loading: actual request flags disable submission; existing debounce/abort
  behavior and result invalidation remain unchanged.
- [x] Errors: estimate and cost-table errors still show alerts; invalid level and
  invalid star range prevent valid submissions; editing clears obsolete results.
- [x] Persistence: estimate remains in mounted component state, with no new storage.
- [x] Navigation: estimate/strategy switches and route changes retain existing state.
- [x] URL: unchanged, including existing route normalization and history handling.

**INTENTIONAL VISUAL CHANGE:** panels, steppers, segmented modes, charts, skeletons,
animated values, centered mode headings/dividers. User-requested N/A replaces
duplicate costs for unavailable modes; selectable mode costs are unchanged.
**FUNCTIONAL REGRESSION:** none found.

## Flame Calculator — `/calculators/flames`

- [x] Inputs: class, armor/weapon, level, weapon series/kind, flame type, boss flag,
  four existing scoring weights and a single weighted target score retained.
  No invented per-stat constraints or cost field.
- [x] Defaults: Hero, armor 150, boss on, Black Flame, Fafnir/two-handed sword,
  target 120; weights 10 all-stat, 0.1 secondary, 3 offense, 10 boss damage.
  Existing saved class/weight restoration takes precedence as before.
- [x] Validation: level 1–300 required, weights nonnegative with arbitrary step;
  target allows negative/fractional values. Weapon level/offense remain read-only,
  boss forced on, class weapon restrictions and secondary-weight visibility retained.
- [x] Payloads: same `/api/flame-probability` POST config and numeric target,
  class-derived main/secondary/offense stats and weapon parameters. See authorized
  response extension above.
- [x] Calculations: scoring configuration, weights and target interpretation unchanged.
  Histogram bins are display-only and do not determine target probability.
- [x] Result values: percentage, one-in, impossible/guaranteed messages and count-only
  RollBudget retained; chart shows real returned range probabilities.
- [x] Loading: same busy flag, form disabled during request; overlay/skeleton ends on
  resolution. Previous result clearing is unchanged.
- [x] Errors: request failures show an alert and allow retry without losing inputs.
- [x] Persistence: original shared class/weight save behavior retained; no result history.
- [x] Navigation: shared planner and Flame input identity survive switching routes.
- [x] URL: unchanged plural `/calculators/flames`.

**INTENTIONAL VISUAL CHANGE:** flattened setup, target row, weight labels/chips,
result cards and distribution display; magic-offense label reflects the same weight.
**FUNCTIONAL REGRESSION:** none found. Authorized API extension is not visual-only.

## Potential Calculator — `/calculators/potential`

- [x] Inputs: supported equipment/levels and Black/Red cubes, sale checkbox, multiple
  effect/threshold requirements, add/remove and budget controls retained.
- [x] Defaults: hat, level 250, Black Cube, sale off, STR 13% and cooldown 4 seconds;
  unavailable requirements still adapt to the returned option table.
- [x] Validation: required nonnegative fractional thresholds; duplicate effects
  disabled; at least one available target; unavailable tables prevent calculation.
  **Fixed:** removed targets stop participating in validation during their exit.
- [x] Payloads: same `/api/options` and `/api/item-options` queries and
  `/api/probability` JSON. Client-only `cube_sale` is omitted from the request;
  All Stat still expands/adds to four stat totals; percentiles remain an empty list.
- [x] Calculations: fixed Legendary main-potential model, joint requirements,
  probabilities, expected cubes and sale price logic unchanged. No tier-up selector.
- [x] Result values: same percentage/one-in/budget results; expected-cost card uses
  existing cube cost divided by probability. Preview describes requirements, not
  a fabricated successful roll. Accessible values are exact during visual animation.
- [x] Loading: options/table/calculation states retain disabling and result clearing.
- [x] Errors: initial options retry, item-lines retry and probability errors remain;
  input edits clear stale result/error through the same handler.
- [x] Persistence: transient component state only, retained between visited routes;
  no new storage or history format.
- [x] Navigation: same route and retained calculator; budget controls remain outside
  the calculation form and cannot accidentally submit it.
- [x] URL: unchanged.

**INTENTIONAL VISUAL CHANGE:** cube segments, Legendary badge, animated rows,
preview/available-values panels, metric cards and loading overlay.
**FUNCTIONAL REGRESSION — FIXED:** AnimatePresence retained an empty required input
for approximately 180 ms after removal, unlike the immediate old DOM removal. A
failing browser test reproduced this. `TargetRow` now uses `useIsPresent` to disable
exiting controls immediately; the identical test passes without removing animation.

## Equipment Setup — `/equipment`, Equipment setup tab

- [x] Inputs: job family/class, exact existing slots/catalog, previous/next slot,
  item selection/removal, import/export and save/discard retained. Android stays
  nonselectable; Ring 4 remains fixed. Stats editor fields still depend on item support.
- [x] Defaults: saved equipment/class/weights restored by original helpers; empty
  equipment and fixed ring behavior unchanged. Initial tab still depends on having
  at least five user-selected items, excluding the fixed ring.
- [x] Validation: item/class compatibility, caps, supported roll values, JSON version
  and malformed import handling unchanged; unsupported controls are not invented.
- [x] Payloads: same catalog/options requests. Setup saves locally; no cloud API added.
- [x] Calculations: existing stat/flame/potential/Star Force editors and derived
  values remain connected to the same planner and helpers.
- [x] Result values: displayed item identity, level and recorded stats come from
  existing equipment objects; setup draft remains distinct from saved equipment.
- [x] Loading: import flag and existing busy guards retained; lazy-load/slot skeletons
  replace text. Local saved data is read synchronously without fake delays.
- [x] Errors: import and browser-save errors remain; rejected imports do not overwrite
  saved equipment. Save-and-open waits for save confirmation.
- [x] Persistence: same `maplestory-flame-equipment` key, legacy cookie fallback,
  saved structure, IDs, version-1 JSON, export/import and draft/save/discard behavior.
  Saved edits and removals survive reload; other fields remain intact.
- [x] Navigation: setup/stats and active slot retained. Explicit save-before-open
  action is the authorized exception documented above.
- [x] URL: setup and stats still share `/equipment`; no new URL/schema invented.

**INTENTIONAL VISUAL CHANGE:** character backdrop, slot arrangement/highlights,
labels instead of empty icons, selected-item summary and relocated save controls.
**FUNCTIONAL REGRESSION:** none found beyond the explicitly approved action change.

## Equipment Upgrade Order — `/equipment`, Stats & upgrades

- [x] Inputs: existing category filters, Shining, MVP, cube/sale, potential weights,
  shared flame/Star Force weights and equipment-derived laddering settings retained.
  No new unsupported budget, priority or character data introduced.
- [x] Defaults: all three categories; Black Cube, sale off, Shining on, MVP none,
  laddering off; potential weights 10/10/8 and original shared weights. Saved settings
  still override defaults; initial result category is Star Force, flame display Black.
- [x] Validation: nonnegative required weights, no equipment/no category guards,
  existing supported-item filters and unavailable reasons retained.
- [x] Payloads: complete `/api/equipment-upgrade-plan` body matches the frozen old
  fixture, including equipment stats, costs, categories and laddering fields.
- [x] Calculations: same prerequisite-aware Star Force ordering/grouping/top-20,
  potential ranking order, descending Flame improvement chance and Overall plan.
  Animation never mutates ranking or score state.
- [x] Result values: current score, gain, booms, costs, efficiency per 100M and
  prerequisites retained (some moved into expandable details); Overall cumulative
  cost, copy information and flame confidence controls remain available.
- [x] Loading: same request-key tracking, cancellation and submit guard; skeleton
  table replaces loading text only while a request is running.
- [x] Errors: request alerts, stale-input prompt, unsupported/excluded items and
  no-eligible-result messages retained.
- [x] Persistence: same saved equipment and upgrade settings; no result-history writes.
- [x] Navigation: existing category and flame-type switches, equipment source and
  Star Force strategy access remain; planner navbar link still opens `/equipment`.
- [x] URL: no separate upgrade-order URL existed; none was introduced.

**INTENTIONAL VISUAL CHANGE:** sidebar, ranked/expandable rows, mobile cards, icons,
layout animation, crossfades and relocation of assumptions/details.
**FUNCTIONAL REGRESSION:** none found.

## Bug Report — `/bug-report`

- [x] Inputs: same seven area values and summary, steps, expected, actual,
  environment and contact fields; prepare/review/send/copy/download retained.
  Original application had no attachments support; none was invented.
- [x] Defaults: area Star Force, empty fields, no prepared report or submission.
- [x] Validation: required non-whitespace summary (120 characters); required
  steps/expected/actual (2000 each); optional environment/contact (200 each).
- [x] Payloads: same `/api/bug-reports` POST fields and UUID `request_id`; stable ID
  across retries, new preparation after edits, same successful `report_id` handling.
- [x] Calculations: report formatting, copy text, download filename/content and
  duplicate-send guard unchanged; no calculator logic involved.
- [x] Result values: same returned report reference and prepared text; friendly
  success panel does not synthesize a reference or silently clear entered fields.
- [x] Loading: fields/submission disabled during actual send; submit guard retained.
- [x] Errors: accessible submission alert; all fields preserved on failure; copy
  failure still offers manual copy/download. Retry uses the same payload/ID.
- [x] Persistence: same in-memory form/review state; no new browser storage.
- [x] Navigation: report route, retained visited form, review and download actions remain.
- [x] URL: unchanged.

**INTENTIONAL VISUAL CHANGE:** category radio chips replace the select using identical
values; form/sidebar layout, button spinner and success-check animation.
**FUNCTIONAL REGRESSION:** none found.

## Global navigation, presentation and remaining limits

- [x] Exact route map: `/`, `/calculators/starforce`, `/calculators/flames`,
  `/calculators/potential`, `/equipment`, `/bug-report`. Existing `.html`,
  `/index.html` and trailing-slash normalization remains in `routes.js`.
- [x] Back/forward, ordinary client navigation and native modified-click/new-tab
  behavior remain. Home calculator cards and saved-build access use existing URLs.
- [x] Lazy visited pages remain mounted; route animations do not key/remount the
  controller tree. Mobile navigation and keyboard dropdown operation are covered.
- [x] Theme changes preserve field values, storage, route and request count.
  Backgrounds, icons, typography, footers, responsive layouts, skeletons and motion
  are **INTENTIONAL VISUAL CHANGE**. No authentication/search service was invented.

The browser suite uses controlled responses; local API tests exercise actual Python
handlers/engines but do not contact production services. Clipboard/download actions
and some secondary editor/error branches were source-compared rather than all being
individually automated. Existing Firefox tests require geckodriver and were not run.
No backend endpoint or formula was changed during this audit. The only application
fix is disabling removed Potential controls during their existing exit animation.
