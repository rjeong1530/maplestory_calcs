# UI migration regression checks

Run from `frontend`:

```sh
npm run test:regression
```

This uses the existing Node test runner and Chrome/CDP workflow harness. It runs
the domain tests and the real React application in an isolated Chrome profile
against mocked API responses. It never reads your normal browser profile,
contacts production APIs, or submits real bug reports. Chrome must be installed;
set `CHROME_BINARY` to its executable if it is not in the default Windows path.
No new test framework or package is required.

Additional checks:

```sh
npm run lint
npm run test:prerender
```

The pre-existing Firefox suite (`npm run test:browser`) additionally requires
Firefox and geckodriver. The regression command above does not depend on them.
Production builds clear `dist`, so run the browser suite after the build if you
want to keep its screenshots in `dist/ui-preview`.

## Historical contract reference

`tests/fixtures/preMigrationContracts.js` freezes literal payloads, route URLs,
and a saved-build example from the contracts in **c533aeb**, before the Workshop
theme commits. Expectations are not calculated with the current request builders.

Reference sources at that commit:

- `src/components/StarForceCalculator.jsx`: numeric star inputs, mode/safeguard
  maps, events, MVP, replacement costs, percentile list and CDF request flag.
- `src/hooks/useFlameCalculation.js`: class-derived stats, weapon configuration,
  weighted score inputs, and a single numeric score threshold.
- `src/components/CalculatorForm.jsx`, `PotentialCalculator.jsx`, and
  `src/data/potentialTargets.js`: cube selection, numeric requirements, All Stat
  expansion and removal of the client-only sale flag from the probability body.
- `src/data/equipmentUpgrade.js`, `equipmentSave.js`, and `equipmentStorage.js`:
  upgrade payloads, browser-save keys, version-1 exports and restoration.
- `src/components/BugReportPage.jsx`: exact report fields plus a generated
  request ID that stays stable on retries.
- `src/data/routes.js`: all six existing URLs.

The pure request builders, save helpers, routes and flame request hook have no
diff from this reference. Tests still compare their outputs with independent
literal fixtures so future accidental changes fail the suite.

## Workflow coverage

The final source comparison and page-by-page checklist are in
[`FINAL_FUNCTIONAL_PARITY_AUDIT.md`](FINAL_FUNCTIONAL_PARITY_AUDIT.md).
The audit added a browser regression test for removing an empty Potential target
while its exit animation is active. Removed controls are immediately disabled so
they cannot block native form validation. The combined suite now has 104 tests.

| Workflow | Regression assertions |
| --- | --- |
| Star Force | Inputs and stepper changes; invalid star ranges; mode and safeguard selection; shining event, superior item and MVP controls; exact POST payload; loading and results; returned CDF and budget lookup; cost/rate tables; retained state when switching views/routes. |
| Flame | Armor/weapon and class selection; weapon level/boss restrictions; default and custom numeric weights; fractional score threshold; exact payload; result and actual server distribution; failed calls and retry loading. |
| Potential | Black/red cube selection; fixed Legendary tier; target editing; add/remove multiple targets; disabled duplicate effects; All Stat expansion; exact payload without UI-only fields; probability and cube-sale cost output. |
| Equipment Setup | Item selection only changes the draft; discard; save; import preview; reload; editing saved Star Force preserves other fields and IDs; saved removal survives reload; fixed Ring 4 remains; legacy saves and version-1 exports round-trip. |
| Upgrade Order | Complete old payload; loading; intentionally reversed Star Force response steps are restored to prerequisite order and combined; expected cost/gain/efficiency/booms; category tabs; filters invalidate results and alter only categories; no-category submission is disabled. Existing domain tests cover multi-item sorting, ties and prerequisite lookahead. |
| Bug Report | Empty required fields, whitespace-only title and original length limits; exact POST fields and UUID; review before send; success; failure preserves all entered fields; retry retains the payload and request ID. |
| Routes and presentation | Exact old URL map, card destinations, back/forward, mobile navigation, retained input nodes across routes, desktop/mobile layouts, light/dark switching without state/storage/route changes or new API calls. |

## Scope and intentional differences

Potential has **no tier selector** in the original calculator: it models
Legendary main potential. The test asserts that this remains fixed; it does not
invent a selectable tier or additional cube types. Upgrade categories are the
existing filters; there is no added priority or budget setting.

The previously authorized additive Flame distribution response powers a chart;
request payloads and scoring interpretation remain unchanged. The separately
requested “Save equips & edit stats” action intentionally saves before navigating,
and is covered as the accepted behavior.

These tests verify frontend contract compatibility and rendering with known
responses, not the live backend's probability calculations or live-service
availability. Domain tests exercise the existing frontend conversion, sorting,
budget and persistence logic. No application code, formulas, endpoints or visual
design are changed by this regression-test step.
