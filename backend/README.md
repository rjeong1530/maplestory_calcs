# Backend

FastAPI HTTP endpoints over Python probability and equipment-planning engines.
The service uses bundled data and has no database or user accounts.

See the [project README](../README.md#quick-start) for setup and
[deployment settings](../README.md#deployment) for hosting and CORS.
Run Python commands from the **repository root**, using the virtual environment.
Runtime dependencies are in [requirements.txt](../requirements.txt).

## API

Run the server with `python -m uvicorn backend.api.main:app --reload`.
Open `http://127.0.0.1:8000/docs` for current request schemas and interactive
examples, or `/openapi.json` for the schema. The backend root `/` has no page.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Availability check. |
| GET | `/api/options` | Potential equipment, levels, cube types, and effect keys. |
| GET | `/api/item-options` | Obtainable potential and flame values for an item. |
| GET | `/api/starforce-costs` | Per-star costs and transition rates. |
| POST | `/api/probability` | Probability of meeting all potential targets on one roll. |
| POST | `/api/flame-probability` | Probability of reaching a weighted flame score. |
| POST | `/api/starforce-estimate` | Expected costs, attempts, booms, and optional budget estimates. |
| POST | `/api/starforce-strategies` | Compare per-star policies and cost/spare tradeoffs. |
| POST | `/api/equipment-upgrade-plan` | Rank upgrades for the supplied equipment and weights. |

Requests and validation live in [api/main.py](api/main.py). The equipment endpoint
receives browser-saved gear with each request; the backend does not store it.
Strategy reports have a bounded in-process cache of 32 input combinations.
See the [calculation assumptions](../README.md#calculation-assumptions) before
interpreting results.

## Request limits

[api/limits.py](api/limits.py) controls admission to calculation endpoints:

| Environment variable | Default |
| --- | --- |
| `CALCULATION_CONCURRENCY` | 2 running calculations |
| `CALCULATION_QUEUE_SIZE` | 8 waiting requests |
| `CALCULATION_QUEUE_TIMEOUT_SECONDS` | 20 seconds |
| `CALCULATIONS_PER_MINUTE` | 300 per client |

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
