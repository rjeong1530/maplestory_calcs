# MapleStory equipment and upgrade calculators

This repository contains a Python probability engine and a React web app for
planning MapleStory potentials, flames, and Star Force upgrades. The web app has four sections:

- **Potential** estimates the chance that all selected potential targets appear
  on the same three-line roll, plus independent-roll cube estimates.
- **Flames** estimates the chance of reaching a target flame score for armor or
  weapons, using configurable stat weights.
- **Star Force** shows per-tap costs and estimates mesos, attempts, and booms
  for a target star count, with enhancement modes and safeguards.
- **Equipment** lets you select gear, record its current potential and flame
  lines, review combined flame stats, and compare expected upgrade gains and costs.

In **Equipment upgrade order**, select Star Force, Flames, and/or Potential to
calculate only those upgrade orders. Flames calculates both Black and Abyssal results;
use the icon toggle to display either type instantly without recalculating.
Each has flame counts for a 25%, 50%, 75%, or 99% chance of improvement.
Black Flames also has a matching cost chart at a fixed 3M mesos per flame;
Abyssal Flames shows odds and counts only. Upgrade category selections are saved
in the browser. Flame costs are fixed in the upgrade planner.

Star Force's **Best gain per meso** order looks ahead one to six additional stars
on each item and compares total weighted gain divided by total expected meso cost,
including every prerequisite step. For items below 15 stars, it also compares
targets from 16–21 stars (where supported), including the full cost of reaching
those targets, so the six-star horizon does not hide post-15 gains.
It selects the best range, then repeats from
the planned star levels. Consecutive ranges for the same item merge into one row;
earlier stars always come first. This is a rolling comparison, not a
globally optimal spending plan.

Set **Max Star Force for upgrades** beside an item's current stars to limit its
upgrade recommendations. It defaults to the equipment cap and is saved with
your equipment, including JSON exports. A limit at or below the current stars
stops further Star Force recommendations for that item.

Set **Replacement cost per boom (mesos)** in the Star Force calculator or an
item's Equipment details. It defaults to 0, except Astra secondaries default
to 1,000,000,000 mesos. An explicit 0 overrides that default. Equipment values
are saved and exported; older saves receive the default when the field is absent.
Star Force upgrade rows show expected booms and total mesos, including expected
booms multiplied by replacement cost. Best gain per meso uses that total cost.

Use **Export JSON** in the Equipment tab to download your current equipment
class, items, Star Force, potentials, and flames. **Import JSON** restores an
exported file and replaces the current equipment set and equipment class.
Invalid files leave the current set unchanged. Per-item Star Force modes and
safeguards are included; calculator score weights and upgrade-planner settings
are not included in equipment exports.

Ring slot 4 is always Ring of Restraint and cannot be replaced, removed, or
edited. It is generated automatically for display and omitted from browser saves,
JSON exports, and enhancement rankings. Existing saves and JSON
imports replace any previous ring-4 item with this fixed ring; slots 1-3 remain
editable. Bounty Legend's Sunglasses are excluded from the catalog and future
fetches. Earrings are limited to Commanding Force Earring, Estella Earrings,
and Superior Gollux Earrings.

Equipment, recorded lines, class selections, and flame score weights are saved
in browser local storage until site data is cleared. Existing cookie saves are
migrated automatically. The calculators are estimates based on the
bundled data and rules described below; they do not model every in-game reset
mechanic or item restriction.

## Quick start

Requirements: Python 3.10+ and Node.js 20.19+ (20.x) or 22.12+ with npm, as
required by the locked frontend dependencies. The commands below use Windows PowerShell.
The repository root is the directory containing this README, `backend/`, and
`frontend/` (in this checkout, `C:\Users\Ryan\maplestory_app`).

In the first terminal, create the Python environment, install dependencies,
and start the API:

```powershell
cd C:\Users\Ryan\maplestory_app
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

In a second terminal, install the locked frontend dependencies and start Vite:

```powershell
cd C:\Users\Ryan\maplestory_app\frontend
npm ci
npm run dev
```

Open the URL printed by Vite. API documentation is available at
http://127.0.0.1:8000/docs. Keep both terminals running. No database, API keys,
or data refresh is required for local use; the data is bundled in the repository.
Dependency installation requires internet access.

Run backend commands from the repository root and frontend commands from
`frontend/`. Examples using plain `python` assume the virtual environment is
activated; otherwise use `.\.venv\Scripts\python.exe`. On macOS/Linux, use
`python3 -m venv .venv` and `.venv/bin/python` in place of the Windows executable.

## Project layout

Run Python commands from the repository root using module paths (`python -m ...`).

```text
maplestory_app/
  README.md
  BACKEND_TESTS.txt                    Backend test cases and run commands
  FRONTEND_TESTS.txt                   Frontend test cases and run commands
  examples/equipment/
    README.md                         Sample import instructions and test coverage
    *.json                            47 importable class equipment test builds
  examples/starforce/
    *.json                            Sample strategy comparison and tradeoff data
    *.csv                             Matching spreadsheet report
  backend/
    api/main.py                       FastAPI endpoints and request models
    calc/
      maplestory_potential.py          GMS values with KMS potential probabilities
      maplestory_flames.py             Flame probabilities and scores
      starforce_calculator.py          Star Force costs and expected outcomes
      equipment_upgrade.py            Equipment upgrade scores and rankings
    data/potential_data.json          Original KMS probability snapshot
    examples/
      potential.py                    Potential calculation examples
      flames.py                       Flame calculation examples
      starforce_strategies.py          Seven presets and exhaustive policy search
    scripts/
      fetch_potential_data.py         Refresh the KMS probability snapshot
      fetch_equipment_data.py         Refresh the frontend GMS equipment catalog
      verify_accessories.py           Compare Nexon accessory probability tables
    tests/                            Python unittest suites
      test_equipment_samples.py       Frontend-to-API samples and table equivalence
      test_starforce_strategies.py     Policy search, recovery, and report exports
      test_strategy_api.py            Strategy endpoint validation and caching
    requirements.txt                  FastAPI, Pydantic, and Uvicorn
    requirements-dev.txt              Runtime dependencies plus HTTP test client
  frontend/
    index.html                        Vite HTML entry point
    package.json                      Frontend dependencies and npm scripts
    package-lock.json                 Locked dependency versions
    vite.config.js                    React plugin and development API proxy
    README.md                         Frontend-specific instructions
    scripts/
      equipment-samples.mjs            Generate sample saves and API test requests
    src/
      main.jsx                        React entry point
      App.jsx                         Calculator tabs and potential state
      api.js                          Shared API request handling
      App.css                         Application styles
      index.css                       Shared styles
      components/                     Calculator, equipment, and upgrade views
        StarForceStrategies.jsx       Recommendations, tradeoff chart, and steps
        StarForceStrategies.css       Responsive strategy comparison styles
      hooks/                          Shared planner, flame, and route state
      data/
        equipment_140_250.json        Bundled GMS equipment catalog
        equipment_140_250.meta.json   Catalog source and filtering metadata
        flameEquipment.js            Equipment slots and class mappings
        flameWeapons.js              Weapon flame configurations
        starforce.js                 Equipment star caps and mode helpers
        starforceStrategies.js       Policy instructions and tradeoff coordinates
        equipmentSave.js             Equipment import/export and restoration
        equipmentStorage.js          Browser storage and legacy-cookie migration
        equipmentLines.js            Shared roll labels and saved-line validation
        equipmentUpgrade.js          Upgrade-planner request construction
        equipmentSamples.test.js     Class samples, transitions, and invalid saves
        *.test.js                    Node data-helper tests
```

Python package directories also contain `__init__.py`. The local `.venv/`,
`frontend/node_modules/`, and generated `frontend/dist/` are ignored by Git.

Run the examples with `python -m backend.examples.potential` or
`python -m backend.examples.flames`. The accessory verification tool runs with
`python -m backend.scripts.verify_accessories` and requires internet access.

Importable test builds for all 47 supported classes are in
[`examples/equipment/`](examples/equipment/README.md). Regenerate them with
`node frontend/scripts/equipment-samples.mjs`. The backend sample integration
test uses Node to import these files and build real frontend requests before
checking the API; it is skipped when Node is unavailable. See
[`BACKEND_TESTS.txt`](BACKEND_TESTS.txt) and
[`FRONTEND_TESTS.txt`](FRONTEND_TESTS.txt) for the complete test inventories.

## Star Force strategy analysis

In the **Star Force** calculator, open **Compare strategies**. Enter the item
level, starting and target stars, and replacement cost per spare, then click
**Compare strategies**. Select a chart point or the tradeoff dropdown to see
per-star instructions. Under **Add your own strategy**, choose Modes 1–3 or
safeguard at 15–17 and Modes 1–4 at 18–21, then click **Plot my strategy**.
Your strategy appears as a pink point, and the chart rescales to include it.
Click it or **View my steps** to inspect costs, expected spares, and instructions.
Editing the strategy hides its old point until you plot it again. These choices
also apply during recovery below the starting star. An expandable table includes
the best approaches for three priorities. The chart plots enhancement spending,
excluding replacements.
This view always uses Shining Star Force, no MVP discount, and standard equipment;
the custom estimate's event, MVP, and mode settings do not change these assumptions.

`POST /api/starforce-strategies` accepts `item_level` (1–300), `start_star`
(0–29), `target_star` (1–30, above the start), and `replacement_cost_mesos`
(0–1e15, default 0). The API caches up to 32 reports by these four inputs.
The response uses the same report structure as the Python analysis below.
Input changes invalidate displayed comparisons; a new comparison is requested
only when the user submits the form.

Run the standalone analysis with the existing calculator's bundled rules:

```powershell
.\.venv\Scripts\python.exe -m backend.examples.starforce_strategies --level 200 --start 15 --target 22 --spare-value 1000000000
```

Shining Star Force is always enabled and MVP is always `none`. The report compares
all 16,384 per-star policies for a target of 22 or higher, including choices used
during boom recovery below the initial star. Star numbers refer to the starting
star of an attempt. Four recommendations optimize enhancement spending, total
cost at the supplied spare value, expected spares, or a balanced tradeoff. The
balanced choice minimizes
the equal-weight sum of normalized enhancement spending and expected spares,
scaled between the efficient frontier's extremes. Recommendations are calculated
for the current inputs and are always on the cost/spare frontier, unlike fixed-mode
baselines. Identical policies are combined in the preset table; separate
recommendation rows remain available for each priority. `--spare-value` can
represent either replacement price or the meso value you assign to a scarce
spare. Zero compares tap costs only. The cost/spare frontier contains policies
where reducing spare usage requires more enhancement spending.

Export data for an app or spreadsheet with:

```powershell
.\.venv\Scripts\python.exe -m backend.examples.starforce_strategies --level 200 --start 15 --target 22 --spare-value 1000000000 --json examples/starforce/level-200-15-to-22.json --csv examples/starforce/level-200-15-to-22.csv
```

The sample files contain those default results. From Python, import
`analyze_strategies` from `backend.examples.starforce_strategies`; it returns a
dictionary with `assumptions`, `scenarios`, `recommendations`, and
`efficient_frontier`. `recommendations` contains one row per priority, including
the balanced tradeoff;
`scenarios` combines rows that use the same policy. Every row includes its
per-star policy, expected enhancement mesos, attempts, spares, replacement
spending, and combined cost. Selected results are calculated again by
`estimate_starforce` before publication.

Expected spares equal booms and exclude the original item. These are averages with
unlimited retries and replacement availability, not success probabilities for a
fixed meso or spare budget. The search covers fixed per-star policies for standard
equipment; choose a target supported by the actual item. Outside 15–21, all policies
use standard rates, so targets above 22 cannot be made boom-free with these options.

## Potential calculator

Calculates three-line **Legendary main potential** rolls with GMS line values
using bundled KMS probability tables from [Nexon's disclosure](https://maplestory.nexon.com/Guide/OtherProbability/cube/black).
Both [red](https://maplestory.nexon.com/Guide/OtherProbability/cube/red) and black
cubes are supported. Current KMS meso potential resets use the black table.
The default is **black**; pass `cube_type="red"` explicitly
for red cubes. This does not calculate tier-up or additional/bonus potential.

GMS uses the higher stat-value band starting at level 151 instead of 201
([level bands](https://maplestorywiki.net/w/Potential)). For the supported levels
151 through 200, main stat, ATT/MATT, damage, and critical-rate percentages gain
one percentage point: Legendary 12% → 13%, Unique 9% → 10%. All Stat becomes
10%/7%. HP/MP/DEF retain their source values in this band, following the
[documented GMS exceptions](https://forums.maplestory.nexon.net/discussion/33097/missing-maxhp-tier-4-potentials-on-main-potential).
Boss damage, IED, critical damage, drop/meso, and cooldown values are unchanged.
Levels 150 and below and 250 retain their source values. This conversion
changes values only; line pools, roll probabilities, and restrictions remain
KMS-based estimates, not independently verified GMS rates.

```python
from backend.calc.maplestory_potential import probability_at_least

chance = probability_at_least(
    "STR_PCT", 30, equipment_type="hat", level=150, cube_type="red"
)
attack_chance = probability_at_least(
    "ATT_PCT", 30, equipment_type="weapon", level=200, cube_type="black"
)
print(f"{chance:.6%}")
```

Pass additional effect/target pairs to require **all targets on the same roll**:

```python
crit_and_str = probability_at_least(
    "CRIT_DAMAGE_PCT", 8, "STR_PCT", 12, equipment_type="gloves"
)
attack_and_boss = probability_at_least(
    "ATT_PCT", 12, "BOSS_DAMAGE_PCT", 40, equipment_type="weapon"
)
str_and_cooldown = probability_at_least(
    "STR_PCT", 13, "COOLDOWN_SEC", 4, equipment_type="hat", level=250
)
```

The same equipment, level and cube keywords work with `probability_exact`,
`probability_cooldown_at_least`, and `matching_combinations`. Edit the three
selection variables in `backend/examples/potential.py` for a simple example with roll-count estimates.

```text
python -m backend.calc.maplestory_potential --equipment gloves --level 200 --cube black --effect CRIT_DAMAGE_PCT --target 16
python -m backend.calc.maplestory_potential --equipment "force shield" --level 150 --cube red --effect ATT_PCT --target 21
python -m unittest discover -s backend/tests -t . -v
```

Levels: **every integer from 100 through 250**. The bundled source snapshots
remain at 100, 140, 150, 160, 200, and 250. Intermediate equipment levels use
the matching potential pool: 100-119 uses 100, 120-150 uses 140, 151-200 uses
160, and 201-250 uses 250; exact snapshot levels retain their own tables.
This preserves the extra hat/glove options unlocked at level 120. GMS stat
values use the actual equipment level, including the increase at 151.
For example, level-110 Maple Treasure secondaries use the level-100 pool
in both the potential editor and upgrade calculations.

Equipment: **weapon, emblem, secondary weapon, force shield, soul ring, shield, hat, top, bottom, outfit,
shoes, gloves, cape, belt, shoulder accessory, accessory, heart**.
Use quotes around multiword equipment names on the command line; the Python
API also accepts underscores. `secondary weapon` uses Nexon's category excluding
Force Shields and Soul Rings. Select `force shield` or `soul ring` for their
shared Nexon probability category, or `shield` for the separate shield category.
`accessory` uses Nexon's face-accessory table, verified to match the available
eye-accessory, earring, ring, and pendant tables. Availability of a particular
accessory at a given level can differ; this selection represents the shared pool.
Some equipment/level combinations do not exist in Nexon's disclosure and raise
a descriptive `ValueError`; missing tables are never extrapolated.
In this snapshot, the 201-250 pool has no table for emblem, secondary weapon, force
shield, soul ring, shield, outfit, belt, or heart, for either cube type.

Effect keys are listed in `EFFECTS` in `backend/calc/maplestory_potential.py`. All Stat adds to
each main stat. Ignore Enemy Defense (`IED_PCT`) combines multiplicatively.
Cooldown uses negative seconds internally; `probability_at_least("COOLDOWN_SEC", 2)`
and `probability_cooldown_at_least(2)` both ask for at least two seconds of reduction.
The cooldown target in `probability_at_least` must be nonnegative.

Korean option names are retained, with converted GMS values in returned lines.
The bundled JSON remains the original KMS snapshot, so refreshing it preserves
the runtime conversion. The calculator enforces caps on decent skills, invincibility duration,
damage-ignore and invincibility-chance categories, renormalizing later pools.
Published rounded probabilities are normalized to sum to one per line.

These are probabilities of generated rolls, **not an exact simulation of a
sequence of in-game resets**. Nexon also rejects an identical previous result;
that rule depends on the starting potential and is not modeled here.
`cubes_for_probability` therefore remains an independent-roll estimate. The
Potential tab does not model keep/replace decisions or meso costs; the Equipment
upgrade planner separately estimates the cost of obtaining a better score.

`backend/data/potential_data.json` records the retrieval timestamp and all queried tables.
Runtime calculations work offline with Python 3.10+. To refresh the snapshot,
run `python -m backend.scripts.fetch_potential_data` with internet access. A failed refresh leaves
the previous snapshot intact.

## Star Force calculator

`backend/calc/starforce_calculator.py` estimates expected meso cost, attempts, and booms to
reach a target star. It uses the supplied GMS base-cost formula and transition
probabilities, with the Enhancement Mode rates and cost multipliers supplied
for 15★–21★ attempts. See the [GMS v269 patch notes](https://www.nexon.com/maplestory/news/update/41138/updated-6-30-v-269-ride-the-lightning-patch-notes)
for the Enhancement Mode availability rules. For example:

```powershell
.\.venv\Scripts\python.exe -m backend.calc.starforce_calculator --level 200 --start 15 --target 22 --mode-18 2 --mode-19 3 --mode-20 4 --safeguard-15-17
```

The band-wide `--mode-15-17` and `--mode-18-21` options set defaults for their
respective ranges. Optional `--mode-15` through `--mode-21` arguments override
the mode for an individual transition (for example, `--mode-18 2` selects Mode
2 from 18★ to 19★). GMS does not allow Enhancement Mode 4 from 15★ to 17★.
Outside 15★–21★, the supplied base rates and base costs are used. The supplied
rates include GMS's automatic Star Catching success-rate bonus.

`--safeguard-15-17` safeguards attempts from 15★ to 17★: the cost is 3x base,
booms are removed, and failed attempts maintain the current star. As in GMS,
safeguarding resets Enhancement Mode to Mode 1 for these transitions.

Expected values use a Markov-chain model: non-destructive failures maintain
the current star at every level. On destruction, recovered stars are 12★ for
15★–19★, 15★ for 20★, 17★ for 21★–22★, 19★ for 23★–25★, and 20★ for
26★–30★. `--boom-reset-star` overrides this table with one recovery level for
all booms. Expected mesos include replacement spending when supplied through
`--replacement-cost-mesos` (default 0), in addition to enhancement and recovery
taps. Event discounts and other event modifiers are excluded. The calculator is for non-Superior
equipment and does not infer item-level caps. The Equipment tracker records each
item's Star Force and applies level-based maximums plus known equipment exceptions.

## API

From the repository root, create a virtual environment and start FastAPI:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

Interactive API documentation: http://127.0.0.1:8000/docs.
For runtime-only installs, use `backend/requirements.txt` instead.

- `GET /api/health`: health check.
- `GET /api/options`: equipment types, levels, cube types, and effect keys.
- `GET /api/item-options`: potential values and flame options available for an
  item level and equipment type. Potential and flame types can be requested
  independently; flame types are `armor` and `weapon`.
- `POST /api/probability`: probability of meeting every target on the same roll.
- `POST /api/flame-probability`: probability of reaching a target flame score
  on one roll with the supplied equipment, class stats, flame type, and weights.
- `GET /api/starforce-costs?level=200`: per-tap base costs and Enhancement
  Mode 1–4 costs for transitions from 0★ through 29★. Mode 4 is `null` from
  15★–17★ because it is unavailable there.
- `POST /api/starforce-estimate`: expected mesos, attempts, and booms to reach a
  target Star Force. The request accepts `item_level`, `start_star`,
  `target_star`, optional `mode_by_star` and `safeguard_by_star` mappings, and
  an optional `boom_reset_star` override and `replacement_cost_mesos` (default 0).
  `expected_cost` includes replacement spending; `expected_replacement_cost`
  reports that portion separately.
- `POST /api/equipment-upgrade-plan`: weakest-first, largest expected-gain, and
  score-gain-per-meso rankings for Star Force, Flames, and Potential. Send the
  equipped items, current stars/potential/flames, class stats, existing flame
  weights, new potential weights (`base_stat_pct_value`, `attack_pct_value`,
  `crit_damage_pct_value`), and `cube_type`. Superior equipment is excluded.
  Black flames cost 3M mesos; red and black cubes cost 12M and 22M. Potential
  roll odds use the bundled KMS tables. Star Force estimates use each item's
  `mode_by_star` settings (Mode 1 by default), including during recovery, and
  per-item `replacement_cost_mesos` (0 by default, 1B for Astra secondaries).

The upgrade-plan endpoint is stateless; it takes the equipment saved in the browser.
In the **Equipment** tab, open **Stats & upgrades** and use **Equipment upgrade order** to
adjust score weights, choose a cube, and calculate rankings. Switch between
Star Force, Flames, and Potential and select a ranking order. The panel uses the
equipment class and recorded rolls, saves planning settings with the equipment,
and asks for a recalculation when inputs change. Unavailable estimates include reasons.
For example, POST this JSON to `/api/equipment-upgrade-plan` (or use `/docs`):

```json
{
  "main_stat": "STR",
  "secondary_stats": ["DEX"],
  "offense_stat": "ATT",
  "cube_type": "black",
  "flame_weights": {
    "all_stat_pct_value": 10,
    "secondary_stat_per_main": 10,
    "attack_value": 3,
    "boss_damage_pct_value": 10
  },
  "potential_weights": {
    "base_stat_pct_value": 10,
    "attack_pct_value": 10,
    "crit_damage_pct_value": 8
  },
  "equipment": [
    {
      "name": "Arcane Warrior Hat",
      "slot": "hat",
      "equipment_level": 200,
      "equipment_type": "armor",
      "potential_equipment_type": "hat",
      "current_star_force": 17,
      "boss_equipment": true,
      "current_potential": [{ "effect": "STR_PCT", "value": 13 }],
      "current_flames": [{ "option": "STR", "stage": 6 }]
    }
  ]
}
```

Each category in `rankings` returns `weakest_first`, `largest_gain_first`,
`gain_per_meso_first`, and `unavailable` (with reasons). Scores are weighted
stat points, not damage percentages. `action_cost_mesos` is the expected total
spend for the listed one-star step or first roll strictly above the recorded weighted score.
Star Force returns multiple rows per item, from its recorded stars to the equipment
cap or available stat tables. `current_star_force` retains the recorded stars;
`start_star` and `next_star` identify each step. `current_score` is the score at
that step's starting star. Gains and costs are marginal, excluding earlier steps.
Later steps require completing those earlier steps even if they rank higher by
gain per meso. The UI marks these prerequisites; rankings are comparisons of
individual steps rather than a sequence that skips prerequisites.
For potential and flames, cost is the price per roll divided by the probability
of improvement, and gain is the average gain conditional on a better roll.
Equal and worse rolls count toward the cost but do not complete the upgrade.
Potential assumes an already-Legendary item, without tier-up modeling. Red cubes
can temporarily worsen the potential before reaching a better roll. Black cubes
and black flames retain the higher score. Outcomes with no possible improvement
are unavailable. Costs use the supplied planning assumptions, without discounts.
Star Force includes retries and boom recovery regardless of spare availability,
and includes expected boom replacement spending, but excludes events.
Weapons need `base_weapon_offense`; level-250 weapons and weapon estimates
above 25 stars are unavailable. HP-based Star Force scoring is also unavailable.
Superior means the Elite Heliseum/Nova/Tyrant enhancement system; Superior
Gollux items remain eligible. Stat bonuses and equipment caps follow the
[Star Force tables](https://maplestorywiki.net/w/Star_Force_Enhancement/Stat_Tables)
and [enhancement rules](https://maplestorywiki.net/w/Star_Force_Enhancement);
cube replacement follows the [cube descriptions](https://maplestorywiki.net/w/Cube).

For example, to load level-150 armor options, request:

```text
GET http://127.0.0.1:8000/api/item-options?level=150&potential_equipment_type=hat&flame_equipment_type=armor&boss_equipment=true
```

The interactive frontend uses this endpoint to populate the equipment editors.
Use `/docs` to inspect request and response schemas for all endpoints.

Example request body for `POST /api/probability`:

In Postman, choose **POST** and enter the full URL
`http://127.0.0.1:8000/api/probability`. Select **Body > raw > JSON**, then
paste the JSON below. The content type should be `application/json`.
Keep the FastAPI server running in a terminal.

```json
{
  "equipment_type": "hat",
  "level": 250,
  "cube_type": "black",
  "targets": [
    { "effect": "STR_PCT", "target": 13 },
    { "effect": "COOLDOWN_SEC", "target": 4 }
  ],
  "percentiles": [0.5, 0.75, 0.9, 0.95, 0.99]
}
```

The response contains `probability` (0–1), `percentage` (0–100), `one_in`,
and `cube_estimates` entries with `target_probability` and `cubes`. Impossible
targets return probability 0 and `null` for odds and cube counts; certain results
require one cube. Estimates assume independent rolls. Targets must be finite,
nonnegative numbers; cooldown targets use positive seconds of reduction.
Invalid inputs and unavailable equipment/level tables return HTTP 422.
Only `targets` is required; defaults are hat, level 150, black cube, and the
percentiles shown above.

If you get a 404, check the full URL, including `/api/probability`. The root
URL (`http://127.0.0.1:8000/`) has no route. Open `/docs` on the same server
and confirm it shows **MapleStory Potential Calculator** and the probability
endpoint. You can also send `GET http://127.0.0.1:8000/api/health` to check
that the API is reachable.

## Verification

Calculator requests are limited per API worker to two concurrent calculations
and 300 requests per client per minute. Configure `CALCULATION_CONCURRENCY`
and `CALCULATIONS_PER_MINUTE` before starting the API. Busy calculations wait in
a FIFO queue, with up to `CALCULATION_QUEUE_SIZE=8` waiting requests per worker
and `CALCULATION_QUEUE_TIMEOUT_SECONDS=20` seconds to acquire a slot. Waiting is
asynchronous, leaving worker threads available for calculations. Queue-full or
wait-timeout responses return 503; rate-limited requests return 429, both with
`Retry-After`. Queued admissions count toward the per-client rate limit once;
cancelled/disconnected waiters are removed. Set queue size to 0 to reject busy
requests immediately. These are
per-process controls; a multi-worker public deployment also needs shared limits
at its gateway. Client identity uses the server-resolved client address.
For a single-slot deployment, set `CALCULATION_CONCURRENCY=1`; the eight queue
entries are additional waiting requests, not additional concurrent calculations.
The frontend allows 90 seconds for both reads and POST calculations, including
cold startup and queue wait. The queue is in memory, is lost on restart/deploy, and
does not increase CPU capacity or provide durable background jobs.
Star Force and equipment API levels are limited to 1–300 and spare prices to
0–1e15 mesos. Nonfinite calculated costs are rejected rather than returned as
successful null values. These limits do not rewrite saved equipment.

For browser regression tests, install Firefox and put geckodriver on `PATH`
(or set `GECKODRIVER_PATH` to its executable). Set `FIREFOX_BINARY` if Firefox
is not found automatically, then run `npm run test:browser` from `frontend/`.
The test starts an isolated headless profile and a temporary Vite server,
using mocked calculation responses. It checks stale-response handling,
navigation retention, sorting, selected-item strategy application, and
persistence without reading or changing your normal browser data.

Run calculator and API tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -t . -v
```

Tests live in `backend/tests/`. Run a single suite with
`python -m unittest backend.tests.test_api -v` or
`python -m unittest backend.tests.test_potential -v` using the virtual environment.
Default discovery (`python -m unittest -v`) also works from the repository root.

Run the frontend data-helper tests, lint, and production build from `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

The frontend uses Node's built-in test runner. Tests cover navigation behavior,
equipment eligibility and import/export, upgrade ordering, and probability helpers.

To reproduce the Star Force before/after benchmark from the repository root:

```powershell
.\.venv\Scripts\python.exe -m backend.benchmark_starforce --baseline dbc3c58ad9466efc83eeb2150d7651969a44f923 --repeats 5 --output backend/starforce_benchmark_results.json
```

This compares that committed calculator with the working-tree source, checks
every existing output field for exact equality, and records alternating timing
runs plus separate peak Python allocation measurements. Memory tracing makes
the benchmark slower but is excluded from the timing samples. Results are local
calculator measurements, not API latency or process-wide memory measurements.
See `PERFORMANCE_UPDATES.txt` for results and limitations.

To measure frontend loading, run `npm run benchmark:render` from `frontend/`
with the same Firefox/geckodriver setup as the browser regression test. It builds
the production app and measures five cache-disabled navigations per route in
an isolated profile. Set `BENCHMARK_OUTPUT` to choose the output JSON path
(default `rendering-benchmark.json`). Measurements cover visible form readiness,
DOM nodes, and decoded JavaScript bytes; API calculations and external images
are excluded. Recorded before/after samples are `frontend/rendering-before.json`
and `frontend/rendering-after.json`.

## Frontend

For the Render static site, production builds default to the API origin
`https://maplestory-calcs-1.onrender.com`. Override `VITE_API_BASE_URL` at build
time to use a different backend; use an empty value for same-origin API routing.
The backend allows `https://maplestory-calculator.onrender.com` by default.
Override `CORS_ALLOWED_ORIGINS` with a comma-separated list of frontend origins
if the site address changes. Deploy both frontend and backend for these settings
to take effect. Keep the Render static-site rewrite `/*` -> `/index.html` for
client routes; an API rewrite is unnecessary when using the direct backend URL.
The Vite development proxy only applies to the development server.

For local production-preview benchmarks, build with `VITE_API_BASE_URL` set to
an empty string to keep API requests local rather than contacting production.

The React + Vite frontend lives in `frontend/` alongside the Python calculator.
Use a current Node.js LTS release. Start the API in one terminal from the
repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

Then install frontend dependencies and start Vite in a second terminal:

```text
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The Vite development server forwards `/api`
requests to `http://127.0.0.1:8000`, so the API must be running as well.
`npm run build` creates a production build in `frontend/dist`,
`npm run preview` serves that build locally, and `npm run lint` checks the
JavaScript source.

Use `npm ci` instead of `npm install` when installing the exact committed
dependency versions. The development API proxy is configured in
`frontend/vite.config.js`; the generated production files do not include it.

### Potential

Select equipment, item level, and cube type; add minimum potential targets; then
click **Calculate probability**. Every target must be met on the same roll.
Choose success percentiles to see independent-roll cube estimates. Cooldown
targets use positive seconds of reduction. Editing inputs clears the previous
result so displayed odds always match the submitted form.

### Flames

Select a MapleStory class, equipment type, level, and flame type; set the score
weights and target score; then calculate the chance of reaching that score on a
single flame roll. Weapon flame values use the selected weapon configuration
and its base offense. The flame engine determines eligible options and tier
ranges from equipment type, item level, and boss-equipment status.

The flame and Star Force calculators offer 50%, 75%, 90%, 95%, and 99%
success-chance estimates. Flames show the rolls needed for at least one roll
to meet the target score. Star Force shows approximate total meso budgets to
reach the target stars, including failures, safeguards, boom recovery, and
replacement costs, with the selected event and MVP discounts. These are budget
percentiles, separate from the average expected total cost, and not guarantees.
The cost-distribution calculation rounds each transition cost up to one of
65,536 budget bins for conservative estimates. It expands the budget horizon
from twice to sixteen times the mean; unresolved percentiles show as beyond
the calculation limit. The API returns these as `meso_estimates` and retains
`attempt_estimates` for compatibility.
Each meso estimate also returns `rounding_unit_mesos` (the upper bound on
rounding added per transition) and `calculation_limit_mesos` (the explored
budget horizon). The UI displays these separately from the estimated budget.
The solver skips unreachable states but retains the same costs, probabilities,
budget resolution, and percentile values.

### Equipment

Hats have a **Minimum cooldown reduction for upgrades** setting (0–6 seconds).
Potential rankings only accept improved stat rolls that also meet this minimum;
3–4 seconds requires at least two cooldown lines, and 5–6 requires three.
The eligible probability is not renormalized, so cube costs include rejected rolls.
Use Black cubes for constrained hats to retain the existing potential while rolling.
This reserves cooldown capacity in upgrade estimates, not physical line locking.
The minimum is saved locally and in equipment JSON exports.

Equipment selectors group **Pitched**, **Kalos Eternals** (hat, top, bottom,
shoulder), **Limbo Eternals** (cape, gloves, shoes), and other equipment.
Pitched membership follows the [Pitched Boss Set](https://maplestorywiki.net/w/Pitched_Boss_Set).
In **Compare Star Force strategies**, choose an optimized, custom, or efficient
approach under **Inspect or apply an approach**, then apply its modes and
safeguards to all eligible equipment, a group, or selected items. The
**Compare Star Force approaches** button in the equipment stat editor opens
this calculator directly. Current stars,
stats, costs per spare, and upgrade limits are preserved. Costs are recalculated
using each item's level and the Equipment event/MVP settings. Items without
enhancement modes and the fixed skill ring are excluded.

Use **Equipment setup** to choose your class and current gear. Select a slot in
the equipment grid or use the previous/next arrows, then choose an item from
the list beside it. Changes save automatically; JSON import/export remains
available in this view.

Open **Stats & upgrades** to record each equipped item's stats and configure
and calculate upgrade rankings. Both views share the same equipment state,
and switching between them preserves calculation results until inputs change.

Select gear in the equipment window. Below the potential inputs, choose enhancement
modes for each star transition. Modes 1–3 are available from 15–17 stars and
modes 1–4 from 18–21; other transitions use standard rates. Safeguard can be
enabled separately at 15–17 stars; it uses Mode 1 and prevents booms. These settings are
saved and exported with the item and used by the upgrade rankings.
The item editor shows its available
potential values when a published table exists, and its eligible flame tiers
and values. Select up to three current potential lines and four current flame
lines; combined flame stats are shown below the flame table. Flameable slots
include medals. The Equipment class selector is independent of the class used
in the Flames calculator.

Secondary equipment is restricted by exact job through
`frontend/src/data/secondaryEquipment.js`, in addition to the catalog's broad
class families. These restrictions also apply when changing class, restoring
saved equipment, or importing equipment JSON. Every bundled secondary has an
explicit job mapping; new catalog secondaries require a mapping before they
appear in the picker. Classes without a matching item in the bundled catalog
show an empty secondary picker rather than another job's equipment.
This filtering covers job eligibility, not main-weapon/shield pairing rules.

Xenon uses STR, DEX, and LUK as equally weighted primary stats with no
secondary stat. Flame scores and equipment upgrade rankings use all three;
the secondary-stat weight control is hidden for Xenon. Potential All Stat %
contributes to each primary stat, while the flame All Stat conversion remains
controlled by the configured All Stat score weight.

Selections, current lines, both class choices, and flame score weights are
stored under `maplestory-flame-equipment` in browser local storage on the same
site origin. If storage is blocked or full, the app displays a save error and
you can export equipment JSON. Older cookie saves are migrated after a
successful local-storage write. The equipment
catalog is a GMS snapshot of level-140-to-250 equipment from MapleStory.io,
with secondaries expanded to levels 100-250. The existing catalog filenames
are retained. Secondary ID ranges include newer Astra records that the source
labels `Unknown`. Kataras are limited to Fafnir, AbsoLab, Sweetwater, Arcane Umbra,
and Astra. Ordinary shields are limited to Astra, Deimos, and Terminus;
dedicated job secondaries such as Soul Shields and Force Shields are retained.
Its boss-reward values come from item-detail `metaInfo.bossReward`; missing
values default to false. Refresh bundled data with:

```powershell
.\.venv\Scripts\python.exe -m backend.scripts.fetch_potential_data
.\.venv\Scripts\python.exe -m backend.scripts.fetch_equipment_data
```

Both refresh commands need internet access. Production hosting needs an
equivalent `/api` reverse proxy to the FastAPI server.

Hearts are fetched without a level filter, but the catalog retains only Fairy
Heart, Titanium Heart, Plasma Heart, Outlaw Heart, and Total Control. To refresh
only hearts using the existing catalog version:

```powershell
.\.venv\Scripts\python.exe -m backend.scripts.fetch_equipment_data --refresh-hearts
```

Full refreshes also recognize the five Mitra's Rage emblem IDs even when the
source labels their category Unknown, preserving each variant's class restriction.

Catalog filters exclude Red Beryl, Frontier (including FrontierB/FrontierC),
and Commerci items. Pocket choices are limited to Pink Holy Cup and the Red,
Blue, Green, and Yellow Cursed Spellbooks. These rules also apply when using
`--filter-existing` to update the bundled catalog without downloading.

To refresh only secondaries using the existing catalog's GMS version:

```powershell
.\.venv\Scripts\python.exe -m backend.scripts.fetch_equipment_data --refresh-secondaries
```

This preserves other equipment and records the secondary source and retrieval
time in the metadata. Add exact job mappings for any new secondary IDs in
`frontend/src/data/secondaryEquipment.js`; the catalog coverage test checks this.

### Frontend routes

- `/`: landing page with links and descriptions for all four tools
- `/calculators/potential`: potential calculator
- `/calculators/flames`: flame calculator
- `/calculators/starforce`: Star Force calculator
- `/equipment`: equipment and upgrade planning

Navigation uses browser history without full page reloads and supports
Back/Forward and opening links in new tabs. Shared equipment state remains
mounted across routes. Unknown paths show a page-not-found message.
Vite serves these routes during development. Production hosting must serve
`frontend/dist/index.html` for frontend page paths (SPA fallback), while
keeping `/api` requests routed to FastAPI and static assets served normally.

## 📋 Upcoming Features / To-Do List

- [ ] List of expected cost of current equips
- [ ] New Inner ability from KMS
- [ ] Deploy
- [x] GMS potential values (KMS roll probabilities retained)
- [x] Star Force calculator
- [x] Verify starforce costs

API input limits: request bodies are limited to 256 KiB, including streamed
requests; larger bodies receive HTTP 413. Equipment names are limited to 200
characters and slots must use supported identifiers. Invalid flame types, scoring
stats, duplicate stats, and nonfinite or negative weights receive HTTP 422.
Calculator requests retain a 90-second timeout even when callers supply a
cancellation signal. Failed page loads offer a full reload to recover.
