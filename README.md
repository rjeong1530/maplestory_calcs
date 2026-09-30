# MapleStory potential calculator

Calculates three-line **Legendary main potential** rolls using bundled KMS
probability tables from [Nexon's disclosure](https://maplestory.nexon.com/Guide/OtherProbability/cube/black).
Both [red](https://maplestory.nexon.com/Guide/OtherProbability/cube/red) and black
cubes are supported. Current KMS meso potential resets use the black table.
The default has changed from red to **black**; pass `cube_type="red"` explicitly
for red cubes. This does not calculate tier-up or additional/bonus potential.

```python
from maplestory_potential import probability_at_least

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
selection variables in `mapletest.py` for a simple example with roll-count estimates.

```text
python maplestory_potential.py --equipment gloves --level 200 --cube black --effect CRIT_DAMAGE_PCT --target 16
python maplestory_potential.py --equipment "force shield" --level 150 --cube red --effect ATT_PCT --target 21
python -m unittest discover -s tests -t . -v
```

Levels: **100, 140, 150, 160, 200, 250**.

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
In this snapshot, level 250 has no table for emblem, secondary weapon, force
shield, soul ring, shield, outfit, belt, or heart, for either cube type.

Effect keys are listed in `EFFECTS` in `maplestory_potential.py`. All Stat adds to
each main stat. Ignore Enemy Defense (`IED_PCT`) combines multiplicatively.
Cooldown uses negative seconds internally; `probability_at_least("COOLDOWN_SEC", 2)`
and `probability_cooldown_at_least(2)` both ask for at least two seconds of reduction.
The cooldown target in `probability_at_least` must be nonnegative.

Full Korean option names are retained for source fidelity, including untracked
effects. The calculator enforces caps on decent skills, invincibility duration,
damage-ignore and invincibility-chance categories, renormalizing later pools.
Published rounded probabilities are normalized to sum to one per line.

These are probabilities of generated rolls, **not an exact simulation of a
sequence of in-game resets**. Nexon also rejects an identical previous result;
that rule depends on the starting potential and is not modeled here.
`cubes_for_probability` therefore remains an independent-roll estimate. Black
cube keep/replace decisions and meso costs are not modeled.

`potential_data.json` records the retrieval timestamp and all queried tables.
Runtime calculations work offline with Python 3.10+. To refresh the snapshot,
run `python fetch_potential_data.py` with internet access. A failed refresh leaves
the previous snapshot intact.

## API

From the repository root, create a virtual environment and start FastAPI:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn api:app --reload
```

Interactive API documentation: http://127.0.0.1:8000/docs.
For runtime-only installs, use `requirements.txt` instead.

- `GET /api/health`: health check.
- `GET /api/options`: equipment types, levels, cube types, and effect keys.
- `POST /api/probability`: probability of meeting every target on the same roll.

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

Run calculator and API tests with:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -t . -v
```

Tests live in `tests/`. Run a single suite with
`python -m unittest tests.test_api -v` or
`python -m unittest tests.test_potential -v` using the virtual environment.
Default discovery (`python -m unittest -v`) also works from the repository root.

## Project layout

```text
api.py                     FastAPI endpoints and request models
maplestory_potential.py     Probability calculator
potential_data.json        Bundled probability tables
fetch_potential_data.py     Data refresh script
verify_accessories.py      Manual online verification (not an offline test)
mapletest.py               Runnable calculator example
tests/                     Automated calculator and API tests
frontend/                  React application and Vite configuration
requirements.txt           API dependencies
requirements-dev.txt       API and test dependencies
```

## Frontend

The React + Vite frontend lives in `frontend/` alongside the Python calculator.
Use a current Node.js LTS release, then run:

```text
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a production build
in `frontend/dist`, `npm run preview` serves that build locally, and
`npm run lint` checks the JavaScript source.

The calculator UI loads available options from the API. Select equipment,
level, and cube type, add one or more minimum potential targets, and click
**Calculate probability**. Choose success percentiles to see cube estimates.
Cooldown targets use positive seconds of reduction. Editing inputs clears
the previous result so that displayed odds always match the submitted form.

The Flames calculator can record the current potential lines and flame options
for each equipped item. These selections are saved with the equipment cookie.
The Equipment tab has its own MapleStory class selector, independent from the
class used by the Flames calculator; both class selections persist in the cookie.
Potential effects are limited to published tables when available, and flame
options follow the flame engine's level and armor/weapon eligibility rules.
Equipment catalog entries include MapleStory.io's `metaInfo.bossReward` value,
which the equipment selector uses for boss-flame tiers; absent or unavailable
flags default to false. Run `python fetch_equipment_data.py` to refresh the
catalog and its boss-reward values.

Vite forwards `/api` requests to
`http://127.0.0.1:8000` during development; run the API in a second terminal.
React components can call `fetch('/api/options')` or POST JSON to
`/api/probability`. `GET /api/item-options` returns eligible potential effects
and flame options for an item level and equipment type. Production hosting needs
an equivalent `/api` reverse proxy.

TODO:
Refactor potentials for GMS
Flame calculations
Starforce calculations
