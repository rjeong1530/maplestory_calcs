"""Weighted upgrade rankings for equipped gear."""
from __future__ import annotations

from functools import lru_cache
from math import floor, fsum
from typing import Any, Mapping

from backend.calc import maplestory_flames as flames
from backend.calc import maplestory_potential as potential
from backend.calc import starforce_calculator as starforce


BLACK_FLAME_COST = 3_000_000
# Abyssal results report odds and flame counts only, without meso estimates.
FLAME_COSTS = {'black': BLACK_FLAME_COST, 'abyssal': None}
CUBE_COSTS = {'red': 12_000_000, 'black': 22_000_000}
FLAME_SLOTS = {
    'hat', 'pendant', 'face', 'eye', 'earring', 'weapon', 'top', 'pocket',
    'belt', 'bottom', 'gloves', 'cape', 'shoes', 'medal',
}
NON_STARFORCE_SLOTS = {'emblem', 'medal', 'badge', 'pocket', 'android'}

_CLASS_STATS_BEFORE_16 = (0, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40)
_CLASS_STATS_BY_STAR_AND_LEVEL = {
    16: (47, 49, 51, 53, 55, 57),
    17: (54, 58, 62, 66, 70, 74),
    18: (61, 67, 73, 79, 85, 91),
    19: (68, 76, 84, 92, 100, 108),
    20: (75, 85, 95, 105, 115, 125),
    21: (None, 94, 106, 118, 130, 142),
    22: (None, 103, 117, 131, 145, 159),
}
# Per-star increments (not cumulative totals).
# https://maplestorywiki.net/w/Star_Force_Enhancement/Stat_Tables
_ARMOR_ATTACK_BY_STAR_AND_LEVEL = {
    16: (7, 8, 9, 10, 12, 14),
    17: (8, 9, 10, 11, 13, 15),
    18: (9, 10, 11, 12, 14, 16),
    19: (10, 11, 12, 13, 15, 17),
    20: (11, 12, 13, 14, 16, 18),
    21: (None, 13, 14, 15, 17, 19),
    22: (None, 15, 16, 17, 19, 21),
    23: (None, 17, 18, 19, 21, 23),
    24: (None, 19, 20, 21, 23, 25),
    25: (None, 21, 22, 23, 25, 27),
    26: (None, 22, 23, 24, 26, 28),
    27: (None, 23, 24, 25, 27, 29),
    28: (None, 24, 25, 26, 28, 30),
    29: (None, 25, 26, 27, 29, 31),
    30: (None, 26, 27, 28, 30, 32),
}
_WEAPON_ATTACK_AFTER_15 = {
    16: (6, 7, 8, 9, 13),
    17: (13, 15, 17, 18, 26),
    18: (20, 23, 26, 28, 40),
    19: (28, 32, 36, 39, 54),
    20: (37, 42, 47, 51, 69),
    21: (None, 53, 59, 64, 85),
    22: (None, 65, 72, 78, 102),
    23: (None, 95, 103, 110, 136),
    24: (None, 126, 135, 143, 171),
    25: (None, 158, 168, 177, 207),
}
_GLOVE_ATTACK_BY_STAR = (0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 7)


def maximum_star_force(item_level: int, name: str = '') -> int:
    """Return the standard GMS equipment cap, including catalog exceptions."""
    if type(item_level) is not int or item_level <= 0:
        raise ValueError('Equipment level must be a positive integer.')
    if name.startswith('Elite Heliseum'):
        return 3
    if name.startswith('Nova '):
        return 8
    if 'Tyrant' in name:
        return 15
    if name in ('Sweetwater Shoes', 'Sweetwater Gloves', 'Sweetwater Cape'):
        return 15
    if name in ('Ghost Ship Exorcist', 'Sengoku Hakase Badge'):
        return 22
    if item_level < 95:
        return 5
    if item_level < 108:
        return 8
    if item_level < 118:
        return 10
    if item_level < 128:
        return 15
    if item_level < 138:
        return 20
    return 30


def is_superior_equipment(name: str) -> bool:
    return (name.startswith(('Nova ', 'Elite Heliseum'))
            or 'Tyrant' in name)


def _level_band_index(item_level: int) -> int:
    if item_level < 128:
        raise ValueError('Star Force score tables are available for equipment level 128 and above.')
    if item_level < 138:
        return 0
    if item_level < 150:
        return 1
    if item_level < 160:
        return 2
    if item_level < 200:
        return 3
    if item_level < 250:
        return 4
    return 5


def _class_stat_bonus(item_level: int, star: int) -> int:
    if not 0 <= star <= 30:
        raise ValueError('Star Force must be between 0 and 30.')
    if star <= 15:
        return _CLASS_STATS_BEFORE_16[star]
    band = _level_band_index(item_level)
    bonus = _CLASS_STATS_BY_STAR_AND_LEVEL.get(star, _CLASS_STATS_BY_STAR_AND_LEVEL[22])[band]
    if bonus is None:
        raise ValueError(f'Equipment at level {item_level} cannot be enhanced to {star} stars.')
    return bonus


def _weapon_attack_bonus(item_level: int, base_attack: float, star: int) -> float:
    if base_attack is None:
        raise ValueError('Weapon Star Force scoring requires base_weapon_offense.')
    if item_level >= 250:
        raise ValueError('Weapon Star Force stat data is not available at level 250.')
    band = _level_band_index(item_level)
    current_attack = base_attack
    bonus = 0
    for _ in range(min(star, 15)):
        increase = floor(current_attack * 0.02 + 1)
        current_attack += increase
        bonus += increase
    if star <= 15:
        return bonus
    if star > 25:
        raise ValueError('Weapon Star Force stat data is not available above 25 stars.')
    extra = _WEAPON_ATTACK_AFTER_15[star][band]
    if extra is None:
        raise ValueError(f'Weapons at level {item_level} cannot be enhanced to {star} stars.')
    return bonus + extra


def starforce_weighted_score(
    item: Mapping[str, Any],
    star: int,
    main_stat: str | tuple[str, ...],
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
) -> float:
    """Score the cumulative class-stat and attack bonuses at a star level."""
    slot = str(item['slot']).split('-', 1)[0]
    item_level = item['equipment_level']
    if slot in NON_STARFORCE_SLOTS:
        raise ValueError(f'{slot} equipment cannot be Star Forced.')
    if slot in ('secondary', 'shield') and not item.get('name', '').lower().startswith('astra '):
        raise ValueError('Only Astra secondaries and shields are eligible for Star Force upgrades.')
    main_stats = flames.primary_stats(main_stat)
    if 'HP' in main_stats or 'HP' in secondary_stats:
        raise ValueError('HP-based Star Force scores are not yet supported.')
    if star > maximum_star_force(item_level, item.get('name', '')):
        raise ValueError('Current Star Force exceeds the equipment cap.')
    class_stat = _class_stat_bonus(item_level, star)
    stat_score = class_stat * (
        len(main_stats) + len([stat for stat in secondary_stats if stat not in main_stats])
        / flame_weights['secondary_stat_per_main']
    )

    if item['equipment_type'] == 'weapon':
        attack = _weapon_attack_bonus(item_level, item.get('base_weapon_offense'), star)
    elif star <= 15:
        attack = _GLOVE_ATTACK_BY_STAR[star] if slot == 'gloves' else 0
    else:
        band = _level_band_index(item_level)
        attack = sum(_ARMOR_ATTACK_BY_STAR_AND_LEVEL[s][band] for s in range(16, star + 1))
        if slot == 'gloves':
            attack += _GLOVE_ATTACK_BY_STAR[15]

    if slot in NON_STARFORCE_SLOTS:
        raise ValueError(f'{slot} equipment cannot be Star Forced.')
    return stat_score + attack * flame_weights['attack_value']


def _potential_effect_weights(
    main_stat: str | tuple[str, ...],
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
    potential_weights: Mapping[str, float],
) -> dict[str, float]:
    def effect(stat):
        return 'MAX_HP_PCT' if stat == 'HP' else f'{stat}_PCT'

    main_stats = flames.primary_stats(main_stat)
    weights = {effect(stat): potential_weights['base_stat_pct_value'] for stat in main_stats}
    for stat in secondary_stats:
        if stat not in main_stats:
            weights[effect(stat)] = (
                potential_weights['base_stat_pct_value']
                / flame_weights['secondary_stat_per_main']
            )
    weights['ATT_PCT' if offense_stat == 'ATT' else 'MAGIC_ATT_PCT'] = (
        potential_weights['attack_pct_value']
    )
    weights['CRIT_DAMAGE_PCT'] = potential_weights['crit_damage_pct_value']
    weights['BOSS_DAMAGE_PCT'] = flame_weights['boss_damage_pct_value']
    return weights


def _potential_current_score(
    lines: list[Mapping[str, Any]],
    main_stat: str | tuple[str, ...],
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
    potential_weights: Mapping[str, float],
) -> float:
    weights = _potential_effect_weights(
        main_stat, secondary_stats, offense_stat, flame_weights, potential_weights,
    )
    total = 0.0
    for line in lines:
        effect = line.get('effect')
        value = float(line.get('value', 0) or 0)
        if effect == 'ALL_STAT_PCT':
            total += value * fsum(weights.get(f'{stat}_PCT', 0) for stat in
                                  ('STR', 'DEX', 'INT', 'LUK'))
        else:
            total += value * weights.get(effect, 0)
    return total


def _flame_config(
    item: Mapping[str, Any],
    main_stat: str | tuple[str, ...],
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
    flame_type: str = 'black',
) -> flames.FlameConfig:
    return flames.FlameConfig(
        equipment_level=item['equipment_level'],
        equipment_type=item['equipment_type'],
        boss_equipment=item.get('boss_equipment', False),
        flame_type=flame_type,
        main_stat=tuple('MAX_HP' if stat == 'HP' else stat for stat in flames.primary_stats(main_stat)),
        secondary_stats=tuple('MAX_HP' if stat == 'HP' else stat for stat in secondary_stats),
        offense_stat=offense_stat,
        weights=flames.ScoreWeights(**flame_weights),
        base_weapon_offense=item.get('base_weapon_offense'),
    )


def _current_flame_score(item: Mapping[str, Any], config: flames.FlameConfig) -> float:
    return fsum(
        flames.score_values(
            flames.option_values(line['option'], int(line['stage']), config), config,
        )
        for line in item.get('current_flames', [])
    )


@lru_cache(maxsize=128)
def _flame_score_distribution(
    equipment_level: int,
    equipment_type: str,
    boss_equipment: bool,
    main_stat: str | tuple[str, ...],
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    weights: tuple[tuple[str, float], ...],
    base_weapon_offense: float | None,
    flame_type: str = 'black',
) -> dict[float, float]:
    config = _flame_config({
        'equipment_level': equipment_level,
        'equipment_type': equipment_type,
        'boss_equipment': boss_equipment,
        'base_weapon_offense': base_weapon_offense,
    }, main_stat, secondary_stats, offense_stat, dict(weights), flame_type)
    return flames.FlameProbabilityEngine(config).score_distribution()


@lru_cache(maxsize=128)
def _potential_score_distribution(
    equipment_type: str,
    level: int,
    cube_type: str,
    effect_weights: tuple[tuple[str, float], ...],
) -> dict[float, float]:
    return potential.weighted_score_distribution(
        dict(effect_weights), equipment_type=equipment_type,
        level=level, cube_type=cube_type,
    )


def _next_improvement(distribution: Mapping[float, float], current: float,
                      roll_cost: float | None) -> dict[str, Any]:
    """Expected spend and conditional gain until the first strictly better roll."""
    better = [(score, probability) for score, probability in distribution.items()
              if score > current + 1e-9 and probability > 0]
    probability = fsum(chance for _, chance in better)
    if not probability:
        return {'expected_score_gain': None, 'action_cost_mesos': None,
                'gain_per_meso': None, 'expected_attempts': None,
                'note': 'No better weighted score is available.'}
    gain = fsum((score - current) * chance for score, chance in better) / probability
    cost = roll_cost / probability if roll_cost is not None else None
    return {'expected_score_gain': gain, 'action_cost_mesos': cost,
            'gain_per_meso': gain / cost if cost else None, 'expected_attempts': 1 / probability,
            'improvement_probability': probability}


def _rank_category(entries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    scoreable = [entry for entry in entries if entry['current_score'] is not None]
    upgradable = [entry for entry in entries if entry['expected_score_gain'] is not None]
    return {
        'weakest_first': sorted(scoreable, key=lambda entry: (entry['current_score'], entry['name'])),
        'largest_gain_first': sorted(
            upgradable,
            key=lambda entry: (-entry['expected_score_gain'], entry['name']),
        ),
        'gain_per_meso_first': sorted(
            (entry for entry in upgradable if entry['gain_per_meso'] is not None),
            key=lambda entry: (-entry['gain_per_meso'], entry['name']),
        ),
        'unavailable': [entry for entry in entries if entry['expected_score_gain'] is None],
    }


def equipment_upgrade_plan(request: Mapping[str, Any]) -> dict[str, Any]:
    """Rank future Star Force steps and each item's next roll improvement."""
    main_stat = flames.primary_stats(request['main_stat'])
    secondary_stats = tuple(request['secondary_stats'])
    offense_stat = request['offense_stat']
    flame_weights = request['flame_weights']
    potential_weights = request['potential_weights']
    cube_type = request['cube_type']
    cube_cost = CUBE_COSTS[cube_type]
    categories = request.get('categories', ['starforce', 'flames', 'potential'])
    potential_effect_weights = _potential_effect_weights(
        main_stat, secondary_stats, offense_stat, flame_weights, potential_weights,
    )
    results = {'starforce': [], 'flames': [], 'potential': []}
    excluded_superior = []
    flame_results = {flame_type: [] for flame_type in FLAME_COSTS}

    for item in request['equipment']:
        name = item['name']
        slot = str(item['slot']).split('-', 1)[0]
        level = item['equipment_level']
        if is_superior_equipment(name):
            excluded_superior.append({'name': name, 'slot': item['slot']})
            continue

        if 'starforce' in categories:
            current_star = item['current_star_force']
            starforce_base_entry = {
                'name': name, 'slot': item['slot'], 'current_star_force': current_star,
                'current_score': None, 'expected_score_gain': None,
                'action_cost_mesos': None, 'gain_per_meso': None, 'note': None,
            }
            cap = maximum_star_force(level, name)
            planned_cap = item.get('max_star_force')
            if planned_cap is not None:
                cap = min(cap, planned_cap)
            # Keep one unavailable row for capped/unsupported items. Otherwise rank
            # each marginal step independently, retaining the recorded starting star.
            for start_star in range(current_star, max(current_star + 1, cap)):
                starforce_entry = {**starforce_base_entry, 'start_star': start_star}
                if start_star < cap:
                    starforce_entry['next_star'] = start_star + 1
                try:
                    current_sf_score = starforce_weighted_score(
                        item, start_star, main_stat, secondary_stats, offense_stat, flame_weights,
                    )
                    starforce_entry['current_score'] = current_sf_score
                    if start_star >= cap:
                        starforce_entry['note'] = (
                            'Already at or above the selected maximum Star Force.'
                            if planned_cap is not None else 'Already at the equipment Star Force cap.'
                        )
                    else:
                        gain = starforce_weighted_score(
                            item, start_star + 1, main_stat, secondary_stats, offense_stat, flame_weights,
                        ) - current_sf_score
                        estimate = starforce.estimate_starforce(
                            item_level=level, start_star=start_star, target_star=start_star + 1,
                            mode_by_star=item.get('mode_by_star', {}),
                            safeguard_by_star=item.get('safeguard_by_star', {}),
                        )
                        cost = estimate.expected_cost
                        starforce_entry.update({
                            'expected_score_gain': gain,
                            'action_cost_mesos': cost,
                            'expected_attempts': estimate.expected_attempts,
                            'gain_per_meso': gain / cost if cost else None,
                            'enhancement_mode': 1 if item.get('safeguard_by_star', {}).get(start_star, False)
                            else item.get('mode_by_star', {}).get(start_star, 1),
                            'safeguard': item.get('safeguard_by_star', {}).get(start_star, False),
                        })
                except (ValueError, KeyError) as error:
                    starforce_entry['note'] = str(error)
                results['starforce'].append(starforce_entry)
                if starforce_entry['expected_score_gain'] is None:
                    break

        if 'potential' in categories:
            potential_current = _potential_current_score(
                item.get('current_potential', []), main_stat, secondary_stats,
                offense_stat, flame_weights, potential_weights,
            )
            potential_entry = {
                'name': name, 'slot': item['slot'],
                'current_score': potential_current if item.get('potential_equipment_type') else None,
                'expected_score_gain': None, 'action_cost_mesos': None,
                'gain_per_meso': None, 'note': None,
            }
            potential_type = item.get('potential_equipment_type')
            if potential_type:
                try:
                    distribution = _potential_score_distribution(
                        potential_type, level, cube_type,
                        tuple(sorted(potential_effect_weights.items())),
                    )
                    potential_entry.update(_next_improvement(distribution, potential_current, cube_cost))
                except ValueError as error:
                    potential_entry['note'] = str(error)
            else:
                potential_entry['note'] = 'This equipment has no potential table.'
            results['potential'].append(potential_entry)

        if 'flames' in categories:
            for flame_type, flame_cost in FLAME_COSTS.items():
                flame_entry = {
                    'name': name, 'slot': item['slot'], 'current_score': None,
                    'expected_score_gain': None, 'action_cost_mesos': None,
                    'gain_per_meso': None, 'note': None,
                }
                if slot in FLAME_SLOTS:
                    try:
                        config = _flame_config(
                            item, main_stat, secondary_stats, offense_stat, flame_weights, flame_type,
                        )
                        flame_current = _current_flame_score(item, config)
                        distribution = _flame_score_distribution(
                            level, item['equipment_type'], item.get('boss_equipment', False),
                            main_stat, secondary_stats, offense_stat,
                            tuple(sorted(flame_weights.items())), item.get('base_weapon_offense'), flame_type,
                        )
                        flame_entry['current_score'] = flame_current
                        flame_entry.update(_next_improvement(distribution, flame_current, flame_cost))
                    except (ValueError, KeyError) as error:
                        flame_entry['note'] = str(error)
                else:
                    flame_entry['note'] = 'Flames are not supported for this equipment slot.'
                flame_results[flame_type].append(flame_entry)

    results['flames'] = flame_results['black']

    return {
        'cube_type': cube_type,
        'categories': categories,
        'potential_probability_source': 'bundled KMS potential tables',
        'potential_tier': 'legendary',
        'potential_keeps_better_result': cube_type == 'black',
        'black_flame_keeps_better_result': True,
        'starforce_replacement_cost_included': False,
        'starforce_enhancement_mode': None if any(
            any(mode != 1 for mode in item.get('mode_by_star', {}).values())
            for item in request['equipment']
        ) else 1,
        'cost_assumptions_mesos': {
            'black_flame': BLACK_FLAME_COST,
            'abyssal_flame': FLAME_COSTS['abyssal'],
            'red_cube': CUBE_COSTS['red'],
            'black_cube': CUBE_COSTS['black'],
        },
        'excluded_superior_equipment': excluded_superior,
        'flame_rankings': {flame_type: _rank_category(entries)
                           for flame_type, entries in flame_results.items()} if 'flames' in categories else {},
        'rankings': {
            category: _rank_category(entries)
            for category, entries in results.items() if category in categories
        },
    }
