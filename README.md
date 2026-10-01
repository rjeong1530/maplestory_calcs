# MapleStory potential calculator

This repository contains a Python probability engine and a React web app for
planning MapleStory potential and flame rolls. The web app has three sections:

- **Potential** estimates the chance that all selected potential targets appear
  on the same three-line roll, plus independent-roll cube estimates.
- **Flames** estimates the chance of reaching a target flame score for armor or
  weapons, using configurable stat weights.
- **Equipment** lets you select gear, record its current potential and flame
  lines, and review combined flame stats.

Use **Export JSON** in the Equipment tab to download your current equipment
class, items, Star Force, potentials, and flames. **Import JSON** restores an
exported file and replaces the current equipment set and equipment class.
Invalid files leave the current set unchanged. Calculator score weights and
upgrade settings are not included in equipment exports.

Equipment, recorded lines, class selections, and flame score weights are saved
in a browser cookie for one year. The calculators are estimates based on the
bundled data and rules described below; they do not model every in-game reset
mechanic or item restriction.

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
  an optional `boom_reset_star` override.
- `POST /api/equipment-upgrade-plan`: weakest-first, largest expected-gain, and
  score-gain-per-meso rankings for Star Force, Flames, and Potential. Send the
  equipped items, current stars/potential/flames, class stats, existing flame
  weights, new potential weights (`base_stat_pct_value`, `attack_pct_value`,
  `crit_damage_pct_value`), and `cube_type`. Superior equipment is excluded.
  Black flames cost 3M mesos; red and black cubes cost 12M and 22M. Potential
  roll odds use the bundled KMS tables. Star Force gain estimates use Mode 1.

The upgrade-plan endpoint is stateless; it takes the equipment saved in the browser.
In the **Equipment** tab, use **Equipment upgrade order** below the tracker to
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
      "current_potential": [{ "effect": "STR_PCT", "value": 12 }],
      "current_flames": [{ "option": "STR", "stage": 6 }]
    }
  ]
}
```

Each category in `rankings` returns `weakest_first`, `largest_gain_first`,
`gain_per_meso_first`, and `unavailable` (with reasons). Scores are weighted
stat points, not damage percentages. `action_cost_mesos` is the expected total
spend to the next star or first roll strictly above the recorded weighted score.
For potential and flames, cost is the price per roll divided by the probability
of improvement, and gain is the average gain conditional on a better roll.
Equal and worse rolls count toward the cost but do not complete the upgrade.
Potential assumes an already-Legendary item, without tier-up modeling. Red cubes
can temporarily worsen the potential before reaching a better roll. Black cubes
and black flames retain the higher score. Outcomes with no possible improvement
are unavailable. Costs use the supplied planning assumptions, without discounts.
Star Force includes retries and boom recovery regardless of spare availability,
but excludes replacement costs and events.
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
api.py                                  FastAPI endpoints and request models
maplestory_potential.py                 Potential probability calculator
maplestory_flames.py                    Flame eligibility, values, and probability engine
starforce_calculator.py                 GMS Star Force expected-cost calculator
potential_data.json                     Bundled potential probability tables
fetch_potential_data.py                 Potential data refresh script
fetch_equipment_data.py                 Equipment catalog and boss-reward refresh script
frontend/src/components/                React calculator, flame, and equipment views
frontend/src/data/equipment_140_250.json Equipment catalog used by the equipment picker
tests/                                  Automated calculator, API, and Star Force tests
requirements.txt                        Runtime API dependencies
requirements-dev.txt                    API and test dependencies
```

## Star Force calculator

`starforce_calculator.py` estimates expected meso cost, attempts, and booms to
reach a target star. It uses the supplied GMS base-cost formula and transition
probabilities, with the Enhancement Mode rates and cost multipliers supplied
for 15★–21★ attempts. See the [GMS v269 patch notes](https://www.nexon.com/maplestory/news/update/41138/updated-6-30-v-269-ride-the-lightning-patch-notes)
for the Enhancement Mode availability rules. For example:

```powershell
.\.venv\Scripts\python.exe starforce_calculator.py --level 200 --start 15 --target 22 --mode-18 2 --mode-19 3 --mode-20 4 --safeguard-15-17
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
all booms. The reported expected mesos omit item replacement/recovery costs,
event discounts, and other event modifiers. The calculator is for non-Superior
equipment and does not infer item-level caps. The Equipment tracker records each
item's Star Force and applies level-based maximums plus known equipment exceptions.

## Frontend

The React + Vite frontend lives in `frontend/` alongside the Python calculator.
Use a current Node.js LTS release. Start the API in one terminal from the
repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api:app --reload
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

### Equipment

Select gear in the equipment window. The item editor shows its available
potential values when a published table exists, and its eligible flame tiers
and values. Select up to three current potential lines and four current flame
lines; combined flame stats are shown below the flame table. Flameable slots
include medals. The Equipment class selector is independent of the class used
in the Flames calculator.

Selections, current lines, both class choices, and flame score weights are
stored in the `maplestory-flame-equipment` browser cookie. The equipment
catalog is a GMS snapshot of level-140-to-250 equipment from MapleStory.io.
Its boss-reward values come from item-detail `metaInfo.bossReward`; missing
values default to false. Refresh bundled data with:

```powershell
.\.venv\Scripts\python.exe fetch_potential_data.py
.\.venv\Scripts\python.exe fetch_equipment_data.py
```

Both refresh commands need internet access. Production hosting needs an
equivalent `/api` reverse proxy to the FastAPI server.

## 📋 Upcoming Features / To-Do List

- [ ] List of expected cost of current equips
- [ ] GMS potential refactor
- [x] Star Force calculator
- [x] Verify starforce costs
