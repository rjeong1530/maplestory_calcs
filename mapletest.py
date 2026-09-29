from maplestory_potential import (
    probability_at_least,
    probability_exact,
    probability_cooldown_at_least,
    matching_combinations,
    cubes_for_probability
)


# 30%+ effective STR
# All Stat automatically counts toward STR
equipment_type = "hat"  # e.g. "weapon", "gloves", "secondary weapon"
level = 150             # 100, 140, 150, 160, 200, 250
cube_type = "red"     # "red" or "black" (current KMS reset rates)
chance = probability_at_least(
    "STR_PCT", 30,
    equipment_type=equipment_type,
    level=level,
    cube_type=cube_type,
)

print(chance)
print(f"{chance * 100:.6f}%")
if chance == 0:
    print("This target cannot occur with the selected equipment.")
    raise SystemExit(0)
print(f"1 in {1 / chance:,.0f}")

percentiles = [0.50, 0.75, 0.90, 0.95, 0.99]

for percentile in percentiles:
    cubes = cubes_for_probability(chance, percentile)

    print(
        f"{percentile * 100:.0f}% chance: "
        f"{cubes} cubes"
    )
