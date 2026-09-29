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

The same equipment, level and cube keywords work with `probability_exact`,
`probability_cooldown_at_least`, and `matching_combinations`. Edit the three
selection variables in `mapletest.py` for a simple example with roll-count estimates.

```text
python maplestory_potential.py --equipment gloves --level 200 --cube black --effect CRIT_DAMAGE_PCT --target 16
python maplestory_potential.py --equipment "force shield" --level 150 --cube red --effect ATT_PCT --target 21
python -m unittest -v
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
Cooldown uses negative seconds internally; use `probability_cooldown_at_least(2)`
to ask for at least two seconds of reduction.

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
