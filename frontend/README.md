# Frontend

React 19 + Vite 8. See the [project README](../README.md#quick-start) for
installation and the [deployment settings](../README.md#deployment) for Render.
Run the commands below from `frontend/`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite with the `/api` development proxy. |
| `npm run build` | Build production assets in `dist/`. |
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

## Routing and requests

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
embedded at build time; see the root README for `VITE_API_BASE_URL`.

## Code map

- [App.jsx](src/App.jsx), [preloadPage.js](src/preloadPage.js), and
  [DeferredPage.jsx](src/components/DeferredPage.jsx): page layout and loading.
- [useEquipmentPlanner.js](src/hooks/useEquipmentPlanner.js): shared equipment,
  class selections, settings, and browser persistence.
- [useCalculationRequest.js](src/hooks/useCalculationRequest.js): cancellable
  requests whose results are associated with the submitted inputs.
- `src/components/`: calculator forms, results, equipment editors, and upgrade views.
- `src/data/`: bundled equipment, request builders, import/export helpers, and tests.
- `src/App.css`, `src/index.css`, and component styles: presentation.

Equipment and settings use local storage. JSON import/export is handled by
[data helpers](src/data/equipmentSave.js); storage and legacy-cookie migration
are handled by [equipmentStorage.js](src/data/equipmentStorage.js).

## Public files and data

Files in `public/` are copied unchanged to the site root. Keep the sitemap's URLs
in sync with the route list. The favicon, heading logo, `robots.txt`, and Google
verification file also live here.

Equipment data is bundled, so ordinary development needs no refresh. See the
[backend data tools](../backend/README.md#data-and-examples) for refresh commands,
and [sample builds](../examples/equipment/README.md) for importable equipment.
