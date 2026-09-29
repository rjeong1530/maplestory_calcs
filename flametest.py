from __future__ import annotations

from maplestory_flames import (
    FlameConfig,
    ScoreWeights,
    FlameProbabilityEngine,
    probability_within_rolls,
    rolls_for_percentile,
)

config = FlameConfig(
    equipment_level=150,
    equipment_type="armor",
    boss_equipment=True,
    flame_type="black",

    main_stat="STR",
    secondary_stats=("DEX",),
    offense_stat="ATT",

    weights=ScoreWeights(
        all_stat_pct_value=10,
        secondary_stat_per_main=10,
        attack_value=3,
    ),
)

engine = FlameProbabilityEngine(config)
chance = engine.probability_at_least(120)

print(f"120+ flame score: {chance * 100:.6f}%")
print(f"About 1 in {1 / chance:,.1f} rolls")