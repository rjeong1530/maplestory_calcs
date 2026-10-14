# Frontend

React 19, Vite 8, and Tailwind CSS 4. See the [project overview](../README.md)
for the application and repository layout. Run the commands below from
`frontend/` unless stated otherwise.

## Setup

Requires Node.js 20.19+ on the 20.x line or 22.12+ on newer supported lines.

```text
npm ci
npm run dev
```

Open the URL printed by Vite. The development `/api` proxy currently targets
`https://maplestory-calcs-1.onrender.com`. To use a local backend, start it
using the [backend setup](../backend/README.md#setup), change the proxy target in
[vite.config.js](vite.config.js) to `http://127.0.0.1:8000`, and restart Vite.

## Deployment

| Setting | Value |
| --- | --- |
| Repository-root build command | `npm --prefix frontend ci && npm --prefix frontend run build` |
| Publish directory | `frontend/dist` |
| Build-time API address | `VITE_API_BASE_URL` |

Production and preview default to `https://maplestory-calcs-1.onrender.com`.
Set `VITE_API_BASE_URL` before building to use another backend. An explicitly
empty value uses same-origin `/api` requests and requires an API proxy on that
host; Vite preview does not provide one. This variable is embedded in public
JavaScript, so never place secrets in it. Configure the backend's
`CORS_ALLOWED_ORIGINS` for the deployed frontend origin.

Use the route rewrites in [routing and requests](#routing-and-requests) to serve
each prerendered document before the SPA fallback.

## Styling

Use Tailwind utility classes for component styling, including responsive, focus,
hover, and ARIA states. `src/index.css` is the sole stylesheet: it contains the
Tailwind imports, theme tokens, and document defaults expressed with `@apply`.
Keep dynamic choices as complete class names so Tailwind can discover them.
Semantic class names retained on components are DOM/test hooks, not CSS rules.
The prerendered navigation and shared public content use the same utilities.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite with the `/api` development proxy. |
| `npm run build` | Build production assets and prerender public pages in `dist/`. |
| `npm run test:prerender` | Build and validate static page content, metadata, links, and sitemap. |
| `npm run preview` | Serve the production build locally; no development API proxy. |
| `npm run lint` | Run Oxlint. |
| `npm test` | Run Node data-helper and API-client tests. |
| `npm run test:browser` | Run UI regressions in an isolated headless Firefox profile. |
| `npm run test:deployed` | Submit real forms sequentially against the deployed services. |
| `npm run benchmark:render` | Build and measure production frontend loading. |

Browser scripts require Firefox and geckodriver on `PATH`, or `GECKODRIVER_PATH`
pointing to its executable. The regression and benchmark scripts also accept
`FIREFOX_BINARY`. Live smoke tests accept `SMOKE_SITE_URL` and `SMOKE_API_URL`;
by default they contact the production Render services. They are not part of
`npm test`. See [test coverage](../FRONTEND_TESTS.txt).

The rendering benchmark accepts `BENCHMARK_OUTPUT` for its output JSON path.
For benchmarks that should use same-origin API URLs, build with
`VITE_API_BASE_URL` set to an empty string.

## Tests and verification

The current inventory contains **101 helper/API-client tests in 18 files**,
plus one prerender test and three separately invoked browser harnesses.
On 2026-10-14, all 101 tests, lint, the production build, and the prerender test
passed. The browser regression command could not start because geckodriver was
not available on PATH; live smoke tests and the rendering benchmark were not
rerun. Direct isolated Firefox layout checks during the Tailwind migration were
limited to desktop/mobile page layout and equipment views; backend API access
was unavailable. These checks do not replace the full browser regression suite.

`scripts/.tmp-landing-review.mjs` is a tracked, standalone landing-page screenshot
and mobile-layout check. It is not invoked by the package scripts or included in
the 101 helper tests. See [the test inventory](../FRONTEND_TESTS.txt) for its scope.

## Routing and requests

Production builds generate one HTML document per public route, including the bug
report page. Titles, descriptions, canonical URLs, headings, examples, and source
links come from `src/data/pageContent.js`. The static and interactive pages share
`PublicPageContent.js`, so their guides remain consistent. Calculator controls
and saved user equipment still load in the browser; this is prerendered public
content, not server rendering of personalized calculations. No extra service or
build-time API calls are required.

`scripts/prerender.mjs` generates the production sitemap from the route list.
`public/sitemap.xml` provides the same URLs in development. Deploy using
`npm run build` and publish `dist/`. Builds include both directory index files
and `.html` aliases for static hosts. Render serves existing static resources
before fallback rewrite rules. To ensure clean URLs serve their own HTML, place
these **Rewrite** rules above the existing `/*` → `/index.html` fallback:

| Source | Destination |
| --- | --- |
| `/calculators/:tool` | `/calculators/:tool/index.html` |
| `/equipment` | `/equipment/index.html` |
| `/bug-report` | `/bug-report/index.html` |

After deployment, inspect the raw HTML at each calculator URL to confirm its
unique heading and canonical URL, then resubmit `sitemap.xml` in Search Console.
See [Render routing](https://render.com/docs/redirects-rewrites) and
[Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Metadata also updates on in-app navigation and browser history changes. Unknown
client routes receive `noindex`. Calculator loading messages explain that the
free backend may need to wake after inactivity; they do not promise a fixed wait.

[Routes](src/data/routes.js) map `/` to the landing page, `/calculators/potential`,
`/calculators/flames`, and `/calculators/starforce` to calculators, and `/equipment`
to the equipment planner. Navigation uses browser history. Pages load on demand
and remain mounted after their first visit to preserve form state.

[api.js](src/api.js) selects the API base URL and handles cancellation, errors,
and the 90-second request timeout. [main.jsx](src/main.jsx) sends one background
health request on page load to start waking the backend. Calculations are not
automatically retried after failure.

The development proxy in [vite.config.js](vite.config.js) currently targets the
**deployed backend**. For local API work, change its `/api` target to
`http://127.0.0.1:8000` and restart Vite. Production and preview use the API address
embedded at build time; see [deployment](#deployment) for `VITE_API_BASE_URL`.

## Code map

- [App.jsx](src/App.jsx), [preloadPage.js](src/preloadPage.js), and
  [DeferredPage.jsx](src/components/DeferredPage.jsx): page layout and loading.
- [useEquipmentPlanner.js](src/hooks/useEquipmentPlanner.js): shared equipment,
  class selections, settings, and browser persistence.
- [useCalculationRequest.js](src/hooks/useCalculationRequest.js): cancellable
  requests whose results are associated with the submitted inputs.
- `src/components/`: calculator forms, results, equipment editors, and upgrade views.
- `src/data/`: bundled equipment, request builders, and import/export helpers.
- `tests/`: helper and API-client unit tests.
- `scripts/`: prerendering, browser regressions, live smoke checks, and benchmarks.
- `src/index.css` and Tailwind classes in components: presentation.

Equipment setup previews selections, removals, class changes, and imports until
**Save equips** is clicked; **Discard changes** restores the saved set. Stats and
upgrade settings still save automatically. Equipment and settings use local storage.
JSON import/export is handled by
[data helpers](src/data/equipmentSave.js); storage and legacy-cookie migration
are handled by [equipmentStorage.js](src/data/equipmentStorage.js).

## Public files and data

Files in `public/` are copied to the site root. The build then regenerates
`sitemap.xml` from the route list; keep the development copy in sync as well. The favicon, heading logo, `robots.txt`, and Google
verification file also live here.

Equipment data is bundled, so ordinary development needs no refresh. See the
[backend data tools](../backend/README.md#data-and-examples) for refresh commands,
and [sample builds](../examples/equipment/README.md) for importable equipment.

## Laddering equipment upgrades

In **Equipment → Stats & upgrades**, enable laddering on each item and choose its
starting star. The calculator determines minimum flame/potential scores for each
target star by comparing total weighted scores. Use **Second copy** to
record that item's spare stars, flame lines, and potential lines. Both copies are
saved locally and included in equipment JSON exports. An unrecorded second copy
defaults to 0 stars with zero flame/potential scores; an
explicitly recorded copy uses its actual stats, including zero values.

Enabling laddering on an item automatically enforces it in **Overall**; there is
no separate global switch to enable. Calculate and open **Overall**.
At the selected star, the projection enhances the spare while preserving the
equipped copy. It includes catch-up Star Force costs and any rolls needed to reach
the minimum scores, then swaps only when the combined weighted Star Force,
flame, and potential score improves. The former equipped copy becomes the next
spare. Better rolls can justify a swap at equal or lower stars.

These are projected upgrades, not edits to saved equipment. Recalculate after
actual rolls. Copies are assumed owned and potential is assumed Legendary;
acquisition and tier-up costs are excluded. Required preparation is priced using
enabled roll categories. The planner chooses the cheapest attainable pair of
stopping scores that guarantees a total-score improvement for each target star;
it then compares the resulting upgrades by expected gain per meso. Recorded copies
and automatic targets are rescored when weights change. Older saved manual minimums
are ignored. Astra secondaries and cooldown-minimum hats are not supported in laddering.
Individual category tabs continue to show standard upgrade rankings.

## Source of Suffering transfers

SoS laddering offers a Gollux transfer mode with two alternatives in each step:
transfer onto the equipped SoS (retain its flame; rebuild potential) or onto a
spare (include needed flame and potential preparation). Each shows its own target,
roll costs, total cost, and separate SoS/Gollux booms. Targets are optimized
independently; only the option labeled **Used for ranking** contributes to totals.

Transfer mode prioritizes fewer SoS booms, then meso efficiency. Transfers land
at least at 22 stars and the equipped star level; subsequent SoS taps stay within
its cap. Boom recovery restores the trace and transfers a rebuilt donor. Enter
the expected Legendary tier-up cost explicitly. Initial donor/spare copies are
assumed owned; missing spare stats count as zero. Recalculate after one SoS
sequence with actual results and remaining inventory.

The equipped option includes optional +2-donor tapping advice; that advice is
not part of the cost model. Legacy `restore_trace` values are accepted but ignored.
See the [transfer guide](../examples/laddering/GOLLUX_TRANSFER.md) and
[importable example](../examples/laddering/gollux-transfer.json).
