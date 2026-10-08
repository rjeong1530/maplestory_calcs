# Deployment review — 2026-10-08

Targets: https://maplestory-calculator.onrender.com and
https://maplestory-calcs-1.onrender.com.

## Results

- Live frontend and backend health returned HTTP 200. All five frontend routes
  returned the SPA HTML when loaded directly.
- Isolated headless Firefox successfully submitted Potential, Flames, Star Force,
  strategy comparison, custom strategy, and equipment upgrade forms. The equipment
  check used one Hero hat and all upgrade categories to limit production work.
- Observed warm POST response times in the first run: Potential 173 ms, Flames
  161 ms, Star Force including budget distribution 4,527 ms, strategy comparison
  4,193 ms, custom strategy 92 ms. These are individual observations, not load-test
  percentiles or cold-start measurements.
- Cross-origin POST preflight succeeded for the deployed frontend. Invalid empty
  potential targets returned the expected HTTP 422 with the correct CORS header.
- 144 backend tests passed, including queue capacity, timeout, disconnection,
  rate-limit, and slot-release checks. Python emitted an existing FastAPI test-client
  deprecation warning about httpx; it did not fail the tests.
- After fixes, 95 frontend unit tests and the expanded browser regression test
  passed. Production build and lint passed.

## Local fixes

1. Option reads now use the same bounded 90-second timeout as calculations.
   Previously they expired after 30 seconds, potentially preventing form setup
   during a cold start. Removed the extra 30-second timer in the potential form.
2. Non-JSON HTTP 429 and 5xx errors now explain rate limiting or a starting/busy
   service. JSON validation and queue messages remain intact. Calculations are
   not automatically retried, avoiding duplicate expensive work.
3. Star Force cost-table requests wait 250 ms for typing to settle. Invalid levels
   do not fetch. Changing an event setting while the level is invalid no longer
   leaves the cost panel showing a loading state indefinitely.
4. Browser validation now rejects negative flame weights, levels above 300,
   excessive replacement prices, and Star Force targets at or below starting
   stars before submission. Backend validation remains authoritative.
5. Added an opt-in `npm run test:deployed` smoke test. Existing browser regression
   coverage now checks invalid submissions, busy-service recovery, and debouncing.

These changes have not been deployed.

## Free-service constraints and remaining opportunities

- The two-calculation limit is this application's default **per-process concurrency
  limit**, not a restriction to two calculator types. Defaults are two running,
  eight waiting, and a 20-second queue deadline. Upgrade instance for more workers
- Render documents free web services sleeping after **15 minutes** without traffic
  and startup taking about a minute: https://render.com/docs/free#spinning-down-on-idle.
  The arrival health request starts waking the service, but cannot eliminate that
  delay. The test backend was already warm; real cold-start timing was not measured.
- Retain the finite queue. A larger queue or more concurrency does not add CPU
  capacity and can increase latency/memory pressure. Saturation was exercised in
  local tests rather than by flooding production.
- Star Force estimation and policy comparison were the slowest sampled requests.
  Strategy results already have a bounded backend cache. Measure cache memory and
  request patterns before adding more caches on the free instance.
