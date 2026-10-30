# Maple Workshop frontend performance pass

## Changes made

| Area | Finding | Change |
| --- | --- | --- |
| Star icon | 703,405-byte PNG at 48–52 CSS pixels | 128px WebP, 4,718 bytes (99.3% smaller). Original retained; icon stays eager-loaded. |
| Star Force chart | Rebuilt a 4,097-point SVG path on unrelated parent renders | `React.memo` skips unchanged distribution props; new results and reduced-motion changes still render. |
| Flame chart | Unrelated renders repeated SVG work; hover/focus repeatedly formatted range labels | `React.memo` plus `useMemo` for labels keyed by bins. Active range remains ordinary local state. |
| Equipment grid | Revisited shared planner pages rendered all slots on unrelated form updates | `React.memo` around WorkshopEquipmentGrid, using ordinary shallow props, without a custom comparator that could hide state changes. |
| Character scenery | CSS backgrounds could download below the fold | IntersectionObserver enables scenery within 200px of the viewport, once; observer disconnects afterward and on unmount. Browsers without it load normally. Slots/icons remain immediately available. |

No API, calculation, route, save format, validation or animation was removed or changed.
No blanket memoization, new runtime library, speculative callback caching or permanent
`will-change` layers were added.

## Existing optimizations retained

- React page/component boundaries already split Potential, Flame, Star Force,
  Bug Report, equipment setup and equipment stats. Visited pages deliberately remain
  mounted to preserve user inputs. No remounting or extra lazy boundaries were added.
- Startup preloading keeps nested lazy boundaries from repeatedly suspending.
- Equipment restoration/catalog selection and upgrade payload/ranking work already
  use memoization. Probability engines execute in the backend. No costly scoring
  operation was moved into presentation render.
- Main scenery already uses WebP: day/night desktop 112,024/115,232 bytes, mobile
  45,368/47,692 bytes. Character scenery is 97,466/61,330 bytes. Large source PNGs
  are preserved but not used as the page background.
- Above-the-fold page scenery stays eager. Both day/night layers remain available
  for the existing fast theme crossfade; total mobile scenery is about 93 KB.
- Small cube/flame/equipment icons retain their current loading behavior; no new
  per-icon lazy boundaries. The star is served at over 2x its displayed size.
- Framer Motion wrappers provide actual entrance, layout, presence or press effects.
  No evidence justified removing them. Reduced-motion behavior is preserved.
- Runtime dependencies are only React, React DOM and Framer Motion, all used.
  Vite, React/Tailwind plugins, Tailwind, oxlint and React type packages are development
  tooling. No unused runtime dependency was found.

## Measurement and verification

`npm run test:regression` includes a controlled browser render probe under **4x CPU
throttling**. It compares the same component implementation with and without its
memo boundary across 20 parent updates with unchanged props:

| Component | Unmemoized data accesses | Memoized data accesses |
| --- | ---: | ---: |
| Star Force sampled distribution | 20 | 0 |
| Flame bin maps | 40 | 0 |
| Equipment slot lookup | 500 | 0 |

Final local sample for 20 updates: Star Force 170 → 7.4 ms, Flame 234.1 → 6.3 ms,
equipment grid 242.7 → 5.1 ms. The 600ms chart-entrance sample recorded 38 frames,
with median and p95 frame intervals of approximately 16.7 ms under 4x throttling.

The probe separately changes props in the same mounted tree and asserts that data
is read again. Timing samples and an actual Framer Motion chart-entrance frame probe
are written to `dist/ui-preview/render-performance.json` and
`animation-performance.json`. Timing is informational, not a flaky pass/fail budget.
These are development/headless Chrome measurements, not production field metrics
or a guarantee for every physical mid-range phone. The fixture is never imported
by the application or included in production bundles.

Functional suite: **105 tests passed**. The browser suite also retains the complete
six-width light/dark responsive matrix, keyboard controls, API contracts, route/input
retention and saved-build workflows. Production build and lint are checked separately.
Production builds clear `dist/ui-preview`; rerun the browser suite to regenerate it.

Re-encode only the star without touching other artwork:

```sh
node scripts/optimize-workshop-background.mjs star.png
```

This uses local Chrome's existing WebP encoder, with no added image/runtime dependency.
