# MapleStory equipment and upgrade calculators

A React + FastAPI app for estimating enhancement odds, comparing costs, and
planning equipment upgrades.

**[Open the app](https://maplestory-calculator.onrender.com)** ·
**[API documentation](https://maplestory-calcs-1.onrender.com/docs)**

## Features

- **Potential:** estimate the odds of meeting multiple targets on one Legendary
  potential roll, with cube-count and meso-budget estimates.
- **Flames:** calculate armor and weapon flame-score probabilities using class
  stats and configurable weights.
- **Star Force:** estimate mesos, attempts, and booms; compare enhancement modes,
  safeguards, and strategies; explore success chances for a meso budget.
- **Equipment:** save gear and recorded stats, import/export JSON, and compare
  Star Force, flame, and potential upgrades by expected gain and cost.

Equipment and settings are stored in your browser. No account or database is
required. [Sample equipment builds](examples/equipment/README.md) cover all 47
supported classes.

## Quick start

Requires Python 3.10+ and Node.js 20.19+ (20.x) or 22.12+. The commands below use
PowerShell and start from the repository root.

Start the backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

In another terminal, start the frontend:

```powershell
cd frontend
npm ci
npm run dev
```

**Local API routing:** the current [Vite proxy](frontend/vite.config.js) points to
the deployed backend. To use your local API, change its `/api` target to
`http://127.0.0.1:8000` and restart Vite.

Open the frontend URL printed by Vite. Local API schemas and interactive requests
are available at `http://127.0.0.1:8000/docs`; `/api/health` checks availability.
The backend root `/` has no page. Bundled data requires no refresh for normal use.

On macOS/Linux, use `python3 -m venv .venv` and `.venv/bin/python` instead of the
Windows Python commands.

## Testing

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install "httpx>=0.28,<1"
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -t . -v
```

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

For browser regressions, live deployment checks, and loading benchmarks, see the
[frontend commands](frontend/README.md#commands).

See [backend test coverage](BACKEND_TESTS.txt),
[frontend test coverage](FRONTEND_TESTS.txt), and
[performance measurements](PERFORMANCE_UPDATES.txt) for details.

## Deployment

The frontend runs as a Render static site; the backend runs as a separate web
service. From the repository root:

| Service | Build/install command | Publish directory or start command |
| --- | --- | --- |
| Frontend | `npm --prefix frontend ci && npm --prefix frontend run build` | `frontend/dist` |
| Backend | `pip install -r requirements.txt` | `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT` |

Configure the frontend rewrite `/*` → `/index.html` for client-side routes.
Static files in `frontend/public/`, including the sitemap, robots.txt, and Google
verification file, are copied unchanged to the build output.

- `VITE_API_BASE_URL`: frontend build-time API address; defaults to
  `https://maplestory-calcs-1.onrender.com`. An empty value uses same-origin `/api`
  requests and requires API routing on that host.
- `CORS_ALLOWED_ORIGINS`: backend comma-separated list of allowed frontend origins;
  defaults to `https://maplestory-calculator.onrender.com`.

The frontend sends a background health request on arrival to begin waking the
backend. API requests allow up to 90 seconds for startup, queueing, and execution.

The backend defaults to two concurrent calculations per worker with a bounded
waiting queue. See [backend request limits](backend/README.md#request-limits) for
environment variables, worker configuration, and error responses.

On Linux, the requirements install also builds the native Star Force budget
kernel. Redeploy the backend to enable this acceleration; the build and start
commands above stay the same. See [Star Force performance](backend/README.md#star-force-performance-on-render)
for verification and the Windows fallback.

## Calculation assumptions

- Potential covers Legendary main potential, using bundled KMS probabilities
  with GMS line-value adjustments. It does not model tier-ups or bonus potential;
  the probabilities are estimates, not independently verified GMS rates.
- Roll counts assume independent rolls. Expected costs are averages, and budget
  percentiles are approximations rather than guarantees.
- Star Force strategy comparison uses Shining Star Force, no MVP discount, and
  standard equipment. The custom estimator has its own event and mode settings.
- Equipment scores are weighted stat points, not damage percentages. Upgrade
  ordering preserves prerequisites but is not a globally optimal spending plan.
  Unsupported equipment or missing tables produce unavailable results.

The bundled potential data comes from [Nexon's probability disclosures](https://maplestory.nexon.com/Guide/OtherProbability/cube/black);
GMS equipment data comes from [MapleStory.io](https://maplestory.io/).

## Project structure

- `backend/api/`: endpoints, validation, and request limits.
- `backend/calc/`: probability, cost, and upgrade-ranking engines.
- `backend/data/`: bundled probability tables.
- `backend/scripts/`: data refresh utilities.
- `backend/examples/`: Python calculator and strategy-analysis examples.
- `frontend/src/`: React components, hooks, and bundled equipment data.
- `examples/`: equipment saves and Star Force strategy reports.

See the [frontend README](frontend/README.md) for routing and browser tooling, and
the [backend README](backend/README.md) for endpoints, data refreshes, and examples.
