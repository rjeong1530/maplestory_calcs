# Backend

FastAPI HTTP endpoints over Python probability and equipment-planning engines.
Calculators use bundled data without a database or user accounts. Bug reports
are stored separately in MongoDB.

See the [project README](../README.md#quick-start) for setup and
[deployment settings](../README.md#deployment) for hosting and CORS.
Run Python commands from the **repository root**, using the virtual environment.
Runtime dependencies are in [requirements.txt](../requirements.txt).

### Star Force performance on Render

The single Star Force calculator solves a 65,536-bin budget distribution, while
equipment planning only needs expected values. The budget recurrence uses a small
Cython extension compiled during `pip install -r requirements.txt` on Linux.
The existing Render build/start commands still apply; redeploy the backend to
install it. Compilation never runs during startup or a calculation, and Cython
is only a build dependency. The grid, cost rounding, and probability results are
the same as the Python implementation.

[Render's native runtime](https://render.com/docs/native-runtimes) includes GCC.
Verify the extension in a build or shell with
`python -c "from _starforce_budget import budget_cdf; print('Native Star Force ready')"`.
A failed Linux compilation fails installation rather than silently deploying the
slower implementation. Windows setup skips this dependency and uses the portable
Python fallback; with MSVC installed, `python -m pip install ./backend/native`
enables the extension locally too.

Run `python -m backend.benchmark_starforce --skip-memory` to compare the working
tree with a committed baseline, including complete output equality and 0–25
timings. The JSON report records whether the native kernel was loaded.
Local timings measure calculation time, not network, queueing, or Render's
[free-service wake-up delay](https://render.com/docs/free).

## API

Run the server with `python -m uvicorn backend.api.main:app --reload`.
Open `http://127.0.0.1:8000/docs` for current request schemas and interactive
examples, or `/openapi.json` for the schema. The backend root `/` has no page.

| Method | Endpoint                      | Purpose                                                         |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| GET    | `/api/health`                 | Availability check.                                             |
| GET    | `/api/options`                | Potential equipment, levels, cube types, and effect keys.       |
| GET    | `/api/item-options`           | Obtainable potential and flame values for an item.              |
| GET    | `/api/starforce-costs`        | Per-star costs and transition rates.                            |
| POST   | `/api/probability`            | Probability of meeting all potential targets on one roll.       |
| POST   | `/api/flame-probability`      | Probability of reaching a weighted flame score.                 |
| POST   | `/api/starforce-estimate`     | Expected costs, attempts, booms, and optional budget estimates. |
| POST   | `/api/starforce-strategies`   | Compare per-star policies and cost/spare tradeoffs.             |
| POST   | `/api/equipment-upgrade-plan` | Rank upgrades for the supplied equipment and weights.           |

Requests and validation live in [api/main.py](api/main.py). The equipment endpoint
receives browser-saved gear with each request; the backend does not store it.
Strategy reports have a bounded in-process cache of 32 input combinations.
Uncached strategy searches reuse shared policy prefixes and publish the search's
expected-value recurrence directly, avoiding repeated matrix solves for every
frontier row. The independent matrix solver remains the regression reference;
the two methods can differ in their last floating-point digits.
Run `python -m backend.benchmark_strategies --baseline <commit>` to compare
uncached reports and timings against an earlier revision.
See the [calculation assumptions](../README.md#calculation-assumptions) before
interpreting results.

## MongoDB bug reports

Set `MONGODB_URI` on the **backend Render web service** to the MongoDB connection
string. Optionally set `MONGODB_DATABASE` (default: `maplestory`). Keep credentials
out of source files and frontend `VITE_*` variables. Local development reads
process environment variables. To load the ignored root `.env` file locally, run
`python -m uvicorn backend.api.main:app --reload --env-file .env`.

`POST /api/bug-reports` stores the entered fields in `bug_reports`, with a UUID
`_id`, UTC `created_at`, and `status: new`, then returns the reference ID. Review
reports through MongoDB tools; there is no public read endpoint. IP addresses
are used for transient rate limiting and are not stored with reports.

`contact` is optional (up to 200 characters), for a Discord username, Reddit
username, or X handle. It is included in the report preview and stored with the report.

Retries of an unchanged report reuse its ID to avoid duplicate inserts. Database
errors or missing configuration return 503 without clearing the form. Calculators
remain available without MongoDB. Connections are created on demand, pooled (up
to five per worker), and closed on shutdown. Driver operations use a 10-second
[timeout](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/connection-options/csot/).

Submissions have a separate five-request-per-minute client limit per worker, held
in bounded memory and reset on restart. This is basic throttling, not authentication.
The existing request-body limit also applies. The database must allow connections
from the backend and the database user needs insert/read access to the collection
(reads check duplicate submission IDs).

To verify configured storage locally, run
`python -m backend.scripts.verify_bug_report_storage`. It loads `.env`, inserts
one temporary report, verifies retry/read behavior, and removes only that report.
The verification user also needs delete permission for cleanup. Live verification
passed on 2026-10-09; an initial connection timeout succeeded on retry.

## Request limits

[api/limits.py](api/limits.py) controls admission to calculation endpoints:

| Environment variable                | Default                |
| ----------------------------------- | ---------------------- |
| `CALCULATION_CONCURRENCY`           | 2 running calculations |
| `CALCULATION_QUEUE_SIZE`            | 8 waiting requests     |
| `CALCULATION_QUEUE_TIMEOUT_SECONDS` | 20 seconds             |
| `CALCULATIONS_PER_MINUTE`           | 300 per client         |

These limits apply **per worker process**. Use one worker to retain a service-wide
limit of two running calculations. Waiting is asynchronous; option and health
endpoints do not require a calculation slot. The queue and caches reset on restart.

- HTTP 413: request body exceeds 256 KiB.
- HTTP 422: invalid inputs, unsupported combinations, or unsupported numeric range.
- HTTP 429: client calculation rate limit reached.
- HTTP 503: calculation queue is full or its wait deadline expired.

Rate-limit and queue responses include `Retry-After`. Disconnected queued requests
are removed; cancelling a browser fetch does not guarantee that a calculation
already running on the server stops.

## Tests

Use the [root test commands](../README.md#testing) to install the HTTP test client
and run all backend suites. To run only API tests with the environment activated:

```text
python -m unittest backend.tests.test_api -v
```

Tests use FastAPI's test client and the bundled tables. Equipment sample integration
also uses Node to build frontend payloads and skips that coverage if Node is absent.
See [test coverage](../BACKEND_TESTS.txt) and
[performance measurements](../PERFORMANCE_UPDATES.txt) for detailed checks and benchmarks.

## Data and examples

- `calc/`: potential, flame, Star Force, and equipment-upgrade engines.
- `data/`: bundled potential probability snapshot.
- `scripts/`: data refresh and verification tools.
- `examples/`: Python usage examples and Star Force strategy analysis.

Refresh snapshots from the repository root with internet access:

```text
python -m backend.scripts.fetch_potential_data
python -m backend.scripts.fetch_equipment_data
```

Potential data is written to `backend/data/potential_data.json`; equipment refreshes
update the frontend's `src/data/equipment_140_250.json` and metadata. Normal runtime
does not fetch these sources. Use `python -m backend.scripts.fetch_equipment_data
--help` for equipment refresh options.

Run examples with `python -m backend.examples.potential` or
`python -m backend.examples.flames`. For strategy analysis:

```text
python -m backend.examples.starforce_strategies --level 200 --start 15 --target 22 --spare-value 1000000000
```

Use that command's `--help` for JSON and CSV export options. Importable class builds
and usage instructions are in [examples/equipment](../examples/equipment/README.md).

TODO:

- [x] Laddering equipment upgrades (two-copy Overall projection)
- [ ] Destiny Lib Pt2
- [ ] KMS Inner Ability
- [ ] KMS Soul Enhancement
## SoS transfer planner

`calc/gollux_transfer.py` evaluates equipped and spare transfer alternatives.
Each has separate preparation costs and SoS/Gollux boom counts. Route selection
prioritizes SoS risk, then score gain per meso. Missing spare stats start at zero;
the initial donor/spare are assumed owned. Legacy `restore_trace` is accepted but
ignored, and Astra secondaries reject laddering at API validation.

Recovery estimates are cached only inside a request and shared between recipients
and planner iterations. Roll preparation is reused by final target within each
recipient evaluation; score changes rebuild preparation without repeating the
Star Force solves. One SoS sequence is projected before requiring actual results.
See [transfer assumptions](../examples/laddering/GOLLUX_TRANSFER.md) and
[test inventory](../BACKEND_TESTS.txt).
