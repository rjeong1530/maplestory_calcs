"""Weighted upgrade rankings for equipped gear."""
from __future__ import annotations

from functools import lru_cache
from math import floor, fsum
from typing import Any, Mapping

import maplestory_flames as flames
import maplestory_potential as potential
import starforce_calculator as starforce


BLACK_FLAME_COST = 3_000_000
CUBE_COSTS = {'red': 12_000_000, 'black': 22_000_000}
FLAME_SLOTS = {
    'hat', 'pendant', 'face', 'eye', 'earring', 'weapon', 'top', 'pocket',
    'belt', 'bottom', 'gloves', 'cape', 'shoes', 'medal',
}
NON_STARFORCE_SLOTS = {'emblem', 'medal', 'pocket', 'android'}

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
    main_stat: str,
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
) -> float:
    """Score the cumulative class-stat and attack bonuses at a star level."""
    slot = str(item['slot']).split('-', 1)[0]
    item_level = item['equipment_level']
    if slot in NON_STARFORCE_SLOTS:
        raise ValueError(f'{slot} equipment cannot be Star Forced.')
    if main_stat == 'HP' or 'HP' in secondary_stats:
        raise ValueError('HP-based Star Force scores are not yet supported.')
    if star > maximum_star_force(item_level, item.get('name', '')):
        raise ValueError('Current Star Force exceeds the equipment cap.')
    class_stat = _class_stat_bonus(item_level, star)
    stat_score = class_stat * (
        1 + len([stat for stat in secondary_stats if stat != main_stat])
        / flame_weights['secondary_stat_per_main']
    )

    if item['equipment_type'] == 'weapon':
        attack = _weapon_attack_bonus(item_level, item.get('base_weapon_offense'), star)
    elif slot == 'badge':
        attack = 0
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
    main_stat: str,
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
    potential_weights: Mapping[str, float],
) -> dict[str, float]:
    def effect(stat):
        return 'MAX_HP_PCT' if stat == 'HP' else f'{stat}_PCT'

    weights = {effect(main_stat): potential_weights['base_stat_pct_value']}
    for stat in secondary_stats:
        if stat != main_stat:
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
    main_stat: str,
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
    main_stat: str,
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    flame_weights: Mapping[str, float],
) -> flames.FlameConfig:
    return flames.FlameConfig(
        equipment_level=item['equipment_level'],
        equipment_type=item['equipment_type'],
        boss_equipment=item.get('boss_equipment', False),
        flame_type='black',
        main_stat='MAX_HP' if main_stat == 'HP' else main_stat,
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
    main_stat: str,
    secondary_stats: tuple[str, ...],
    offense_stat: str,
    weights: tuple[tuple[str, float], ...],
    base_weapon_offense: float | None,
) -> dict[float, float]:
    config = _flame_config({
        'equipment_level': equipment_level,
        'equipment_type': equipment_type,
        'boss_equipment': boss_equipment,
        'base_weapon_offense': base_weapon_offense,
    }, main_stat, secondary_stats, offense_stat, dict(weights))
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
    """Rank each equipped item by current score, next-action gain, and efficiency."""
    main_stat = request['main_stat']
    secondary_stats = tuple(request['secondary_stats'])
    offense_stat = request['offense_stat']
    flame_weights = request['flame_weights']
    potential_weights = request['potential_weights']
    cube_type = request['cube_type']
    cube_cost = CUBE_COSTS[cube_type]
    potential_effect_weights = _potential_effect_weights(
        main_stat, secondary_stats, offense_stat, flame_weights, potential_weights,
    )
    results = {'starforce': [], 'flames': [], 'potential': []}
    excluded_superior = []

    for item in request['equipment']:
        name = item['name']
        slot = str(item['slot']).split('-', 1)[0]
        level = item['equipment_level']
        if is_superior_equipment(name):
            excluded_superior.append({'name': name, 'slot': item['slot']})
            continue

        current_star = item['current_star_force']
        starforce_entry = {
            'name': name, 'slot': item['slot'], 'current_star_force': current_star,
            'current_score': None, 'expected_score_gain': None,
            'action_cost_mesos': None, 'gain_per_meso': None, 'note': None,
        }
        try:
            current_sf_score = starforce_weighted_score(
                item, current_star, main_stat, secondary_stats, offense_stat, flame_weights,
            )
            starforce_entry['current_score'] = current_sf_score
            cap = maximum_star_force(level, name)
            if slot in NON_STARFORCE_SLOTS:
                starforce_entry['note'] = f'{slot} equipment cannot be Star Forced.'
            elif current_star >= cap:
                starforce_entry['note'] = 'Already at the equipment Star Force cap.'
            else:
                rates = starforce.attempt_rates(current_star, mode=1)
                reset_star = starforce.boom_recovery_star(current_star)
                destinations = (
                    (current_star + 1, rates.success),
                    (current_star, rates.maintain),
                    (current_star - 1, rates.downgrade),
                    (reset_star, rates.boom),
                )
                expected_after = fsum(
                    probability * starforce_weighted_score(
                        item, destination, main_stat, secondary_stats, offense_stat, flame_weights,
                    )
                    for destination, probability in destinations if probability
                )
                gain = expected_after - current_sf_score
                cost = starforce.starforce_base_cost(level, current_star)
                starforce_entry.update({
                    'expected_score_gain': gain,
                    'action_cost_mesos': cost,
                    'gain_per_meso': gain / cost if cost else None,
                    'next_star': current_star + 1,
                    'enhancement_mode': 1,
                })
        except (ValueError, KeyError) as error:
            starforce_entry['note'] = str(error)
        results['starforce'].append(starforce_entry)

        potential_current = _potential_current_score(
            item.get('current_potential', []), main_stat, secondary_stats,
            offense_stat, flame_weights, potential_weights,
        )
        potential_entry = {
            'name': name, 'slot': item['slot'],
            'current_score': potential_current if item.get('potential_equipment_type') else None,
            'expected_score_gain': None, 'action_cost_mesos': cube_cost,
            'gain_per_meso': None, 'note': None,
        }
        potential_type = item.get('potential_equipment_type')
        if potential_type:
            try:
                distribution = _potential_score_distribution(
                    potential_type, level, cube_type,
                    tuple(sorted(potential_effect_weights.items())),
                )
                after_roll = fsum(
                    probability * (max(potential_current, score) if cube_type == 'black' else score)
                    for score, probability in distribution.items()
                )
                gain = after_roll - potential_current
                potential_entry['expected_score_gain'] = gain
                potential_entry['gain_per_meso'] = gain / cube_cost
            except ValueError as error:
                potential_entry['note'] = str(error)
        else:
            potential_entry['note'] = 'This equipment has no potential table.'
        results['potential'].append(potential_entry)

        flame_entry = {
            'name': name, 'slot': item['slot'], 'current_score': None,
            'expected_score_gain': None, 'action_cost_mesos': BLACK_FLAME_COST,
            'gain_per_meso': None, 'note': None,
        }
        if slot in FLAME_SLOTS:
            try:
                config = _flame_config(
                    item, main_stat, secondary_stats, offense_stat, flame_weights,
                )
                flame_current = _current_flame_score(item, config)
                distribution = _flame_score_distribution(
                    level, item['equipment_type'], item.get('boss_equipment', False),
                    main_stat, secondary_stats, offense_stat,
                    tuple(sorted(flame_weights.items())), item.get('base_weapon_offense'),
                )
                after_roll = fsum(
                    probability * max(flame_current, score)
                    for score, probability in distribution.items()
                )
                gain = after_roll - flame_current
                flame_entry.update({
                    'current_score': flame_current,
                    'expected_score_gain': gain,
                    'gain_per_meso': gain / BLACK_FLAME_COST,
                })
            except (ValueError, KeyError) as error:
                flame_entry['note'] = str(error)
        else:
            flame_entry['note'] = 'Flames are not supported for this equipment slot.'
        results['flames'].append(flame_entry)

    return {
        'cube_type': cube_type,
        'potential_probability_source': 'bundled KMS potential tables',
        'potential_tier': 'legendary',
        'potential_keeps_better_result': cube_type == 'black',
        'black_flame_keeps_better_result': True,
        'starforce_replacement_cost_included': False,
        'starforce_enhancement_mode': 1,
        'cost_assumptions_mesos': {
            'black_flame': BLACK_FLAME_COST,
            'red_cube': CUBE_COSTS['red'],
            'black_cube': CUBE_COSTS['black'],
        },
        'excluded_superior_equipment': excluded_superior,
        'rankings': {
            category: _rank_category(entries)
            for category, entries in results.items()
        },
    }
