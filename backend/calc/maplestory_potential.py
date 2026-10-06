"""Legendary GMS main potential values with bundled KMS roll probabilities.

Bundled Nexon tables; no network or third-party dependencies at runtime.
See README.md for the probability model and limitations.
"""
from dataclasses import dataclass
from functools import lru_cache
import json
import math
from pathlib import Path
import re

TABLE_LEVELS = (100, 140, 150, 160, 200, 250)
SUPPORTED_LEVELS = tuple(range(100, 251))
EQUIPMENT_TYPES = ('weapon', 'emblem', 'secondary weapon', 'force shield',
    'soul ring', 'shield', 'hat', 'top',
    'bottom', 'outfit', 'shoes', 'gloves', 'cape', 'belt', 'shoulder accessory',
    'accessory', 'heart')
CUBE_TYPES = ('red', 'black')
EFFECTS = ('STR_PCT', 'DEX_PCT', 'INT_PCT', 'LUK_PCT', 'MAX_HP_PCT',
    'MAX_MP_PCT', 'ATT_PCT', 'MAGIC_ATT_PCT', 'BOSS_DAMAGE_PCT', 'DAMAGE_PCT',
    'IED_PCT', 'CRIT_RATE_PCT', 'CRIT_DAMAGE_PCT', 'MESO_PCT', 'DROP_PCT', 'COOLDOWN_SEC')
LIMITS = {'decent_skill': 1, 'invincibility_duration': 1,
          'ignore_damage': 2, 'invincibility_chance': 2}


@dataclass(frozen=True)
class Potential:
    line: int
    source_tier: str
    name: str
    probability: float
    effects: dict[str, float]
    restriction: str = ''


def _effects(name):
    for stat in ('STR', 'DEX', 'INT', 'LUK'):
        if match := re.fullmatch(rf'{stat} \+(\d+)%', name):
            return {stat + '_PCT': float(match[1])}
    if match := re.fullmatch(r'올스탯 \+(\d+)%', name):
        return {s + '_PCT': float(match[1]) for s in ('STR', 'DEX', 'INT', 'LUK')}
    patterns = {
        'MAX_HP_PCT': r'최대 HP \+(\d+)%', 'MAX_MP_PCT': r'최대 MP \+(\d+)%',
        'ATT_PCT': r'공격력 \+(\d+)%', 'MAGIC_ATT_PCT': r'마력 \+(\d+)%',
        'BOSS_DAMAGE_PCT': r'보스 몬스터 (?:공격 시 )?데미지 \+(\d+)%',
        'DAMAGE_PCT': r'데미지 \+(\d+)%', 'IED_PCT': r'몬스터 방어율 무시 (?:\: )?\+(\d+)%',
        'CRIT_RATE_PCT': r'크리티컬 확률 \+(\d+)%',
        'CRIT_DAMAGE_PCT': r'크리티컬 데미지 \+(\d+)%',
        'MESO_PCT': r'메소 획득량 \+(\d+)%', 'DROP_PCT': r'아이템 드롭률 \+(\d+)%',
        'COOLDOWN_SEC': r'스킬 재사용 대기시간 -(\d+)초',
    }
    for key, pattern in patterns.items():
        if match := re.fullmatch(pattern, name):
            return {key: float(match[1]) * (-1 if key == 'COOLDOWN_SEC' else 1)}
    return {}


def _restriction(name):
    if '쓸만한' in name:
        return 'decent_skill'
    if '피격 후 무적시간' in name:
        return 'invincibility_duration'
    if '피격 시' in name and '무시' in name:
        return 'ignore_damage'
    if '피격 시' in name and '무적' in name:
        return 'invincibility_chance'
    return ''


def _gms_name(name, level):
    """Convert the GMS 151–200 value band without changing the source pool."""
    if 151 <= level <= 200 and re.fullmatch(
            r'(?:STR|DEX|INT|LUK|올스탯|공격력|마력|최대 HP|최대 MP|데미지|크리티컬 확률) \+\d+%', name):
        return re.sub(r'\d+(?=%$)', lambda match: str(int(match[0]) + 1), name)
    return name


@lru_cache(maxsize=1)
def _data():
    return json.loads((Path(__file__).resolve().parents[1] / 'data' / 'potential_data.json').read_text(encoding='utf-8'))['tables']


def potential_table_level(level):
    """Resolve intermediate levels without crossing option-pool boundaries.

    Nexon's 110 tables match 100; its 120/130 tables match 140, including
    the extra hat/glove lines unlocked at 120. GMS values are adjusted
    separately using the actual equipment level, with the increase at 151.
    """
    if type(level) is not int or level not in SUPPORTED_LEVELS:
        raise ValueError('level must be an integer from 100 to 250')
    if level in TABLE_LEVELS:
        return level
    if level < 120:
        return 100
    if level <= 150:
        return 140
    if level <= 200:
        return 160
    return 250


def get_potentials_by_line(equipment_type='hat', level=150, cube_type='black'):
    """Fresh tables; equipment names accept spaces or underscores."""
    equipment_type = equipment_type.lower().replace('_', ' ').strip()
    cube_type = cube_type.lower().strip()
    if equipment_type not in EQUIPMENT_TYPES:
        raise ValueError(f'equipment_type must be one of {EQUIPMENT_TYPES}')
    table_level = potential_table_level(level)
    if cube_type not in CUBE_TYPES:
        raise ValueError(f'cube_type must be one of {CUBE_TYPES}')
    raw = _data()[f'{cube_type}|{equipment_type}|{table_level}']
    if raw is None:
        raise ValueError(f'Nexon lists no equipment/probability table for {equipment_type} at level {level}')
    result = {}
    for line, rows in enumerate(raw, 1):
        tier = 'Legendary' if line == 1 else 'Unique'
        total = math.fsum(prob for _, prob in rows)
        result[line] = []
        for name, prob in rows:
            if name == raw[0][0][0]:
                tier = 'Legendary'
            name = _gms_name(name, level)
            result[line].append(Potential(line, tier, name, prob / total,
                _effects(name), _restriction(name)))
    return result


def get_effect(potential, effect):
    return potential.effects.get(effect, 0.0)


def _rolls(table):
    """Exclude capped categories, then renormalize the remaining line pool."""
    def visit(combo, probability, counts):
        if len(combo) == 3:
            yield combo, probability
            return
        available = [p for p in table[len(combo) + 1]
            if not p.restriction or counts.get(p.restriction, 0) < LIMITS[p.restriction]]
        mass = math.fsum(p.probability for p in available)
        for p in available:
            next_counts = counts.copy()
            if p.restriction:
                next_counts[p.restriction] = next_counts.get(p.restriction, 0) + 1
            yield from visit(combo + (p,), probability * p.probability / mass, next_counts)
    yield from visit((), 1.0, {})


def weighted_score_distribution(
    effect_weights: dict[str, float],
    *,
    equipment_type='hat',
    level=150,
    cube_type='black',
    minimum_cooldown_seconds=0,
) -> dict[float, float]:
    """Score probabilities; rolls below the cooldown minimum retain no mass.

    Do not renormalize eligible rolls: their rarity affects upgrade costs.
    """
    if type(minimum_cooldown_seconds) is not int or not 0 <= minimum_cooldown_seconds <= 6:
        raise ValueError('Minimum cooldown must be between 0 and 6 seconds.')
    for effect, weight in effect_weights.items():
        if effect not in EFFECTS:
            raise ValueError(f'effect must be one of {EFFECTS}')
        if isinstance(weight, bool) or not math.isfinite(weight) or weight < 0:
            raise ValueError('effect weights must be finite nonnegative numbers')

    table = get_potentials_by_line(equipment_type, level, cube_type)
    line_options = {}
    for line, potentials in table.items():
        grouped = {}
        for option in potentials:
            score = math.fsum(
                option.effects.get(effect, 0.0) * weight
                for effect, weight in effect_weights.items()
            )
            cooldown = min(minimum_cooldown_seconds, -option.effects.get('COOLDOWN_SEC', 0))
            key = (round(score, 8), option.restriction, cooldown)
            grouped[key] = grouped.get(key, 0.0) + option.probability
        line_options[line] = [
            (score, restriction, cooldown, probability)
            for (score, restriction, cooldown), probability in grouped.items()
        ]

    restriction_names = tuple(LIMITS)

    @lru_cache(maxsize=None)
    def rolls_from(line, counts, needed_cooldown):
        if line == 4:
            return ((0.0, 1.0),) if needed_cooldown <= 0 else ()
        counts_by_restriction = dict(zip(restriction_names, counts))
        available = [
            option for option in line_options[line]
            if not option[1] or counts_by_restriction[option[1]] < LIMITS[option[1]]
        ]
        mass = math.fsum(probability for _, _, _, probability in available)
        result = {}
        for score, restriction, cooldown, probability in available:
            next_counts = list(counts)
            if restriction:
                index = restriction_names.index(restriction)
                next_counts[index] += 1
            for remaining_score, remaining_probability in rolls_from(
                    line + 1, tuple(next_counts), max(0, needed_cooldown - cooldown)):
                total_score = round(score + remaining_score, 8)
                result[total_score] = result.get(total_score, 0.0) + (
                    probability / mass * remaining_probability
                )
        return tuple(result.items())

    initial_counts = (0,) * len(restriction_names)
    return dict(sorted(rolls_from(1, initial_counts, minimum_cooldown_seconds)))


def _total(combo, effect):
    if effect == 'IED_PCT':
        return 100 * (1 - math.prod(1 - get_effect(p, effect) / 100 for p in combo))
    return sum(get_effect(p, effect) for p in combo)


def _check(effect, target):
    if effect not in EFFECTS:
        raise ValueError(f'effect must be one of {EFFECTS}')
    if not math.isfinite(target):
        raise ValueError('target must be finite')


def _matches(total, target, mode):
    return math.isclose(total, target, abs_tol=1e-9, rel_tol=0) or (mode == 'at_least' and total > target)


def probability_at_least(effect, target, *additional_targets, equipment_type='hat', level=150, cube_type='black'):
    """Meet all alternating effect/target pairs in the same three-line roll.

    All Stat contributes to main stats; IED stacks multiplicatively.
    COOLDOWN_SEC targets are nonnegative seconds of reduction.
    """
    if len(additional_targets) % 2:
        raise ValueError('Each additional effect must have a target')
    requirements = [(effect, target), *zip(additional_targets[::2], additional_targets[1::2])]
    for key, minimum in requirements:
        _check(key, minimum)
        if key == 'COOLDOWN_SEC' and minimum < 0:
            raise ValueError('COOLDOWN_SEC target must be nonnegative seconds of reduction')
    table = get_potentials_by_line(equipment_type, level, cube_type)
    return math.fsum(p for combo, p in _rolls(table) if all(
        _matches(_total(combo, key) * (-1 if key == 'COOLDOWN_SEC' else 1), minimum, 'at_least')
        for key, minimum in requirements))


def probability_exact(effect, target, *, equipment_type='hat', level=150, cube_type='black'):
    _check(effect, target)
    table = get_potentials_by_line(equipment_type, level, cube_type)
    return math.fsum(p for combo, p in _rolls(table) if _matches(_total(combo, effect), target, 'exact'))


def probability_cooldown_at_least(seconds_reduced, *, equipment_type='hat', level=150, cube_type='black'):
    _check('COOLDOWN_SEC', seconds_reduced)
    if seconds_reduced < 0:
        raise ValueError('seconds_reduced must be nonnegative')
    table = get_potentials_by_line(equipment_type, level, cube_type)
    return math.fsum(p for combo, p in _rolls(table) if -_total(combo, 'COOLDOWN_SEC') >= seconds_reduced)


def matching_combinations(effect, target, mode='at_least', *, equipment_type='hat', level=150, cube_type='black'):
    _check(effect, target)
    if mode not in ('at_least', 'exact'):
        raise ValueError("mode must be 'at_least' or 'exact'")
    table = get_potentials_by_line(equipment_type, level, cube_type)
    matches = []
    for combo, probability in _rolls(table):
        total = _total(combo, effect)
        if _matches(total, target, mode):
            matches.append(dict(lines=[p.name for p in combo], total_effect=total,
                probability=probability, percentage=100 * probability))
    return sorted(matches, key=lambda m: m['probability'], reverse=True)


def validate_probability_distributions(*, equipment_type='hat', level=150, cube_type='black'):
    for line, potentials in get_potentials_by_line(equipment_type, level, cube_type).items():
        if any(p.probability < 0 for p in potentials) or not math.isclose(
                math.fsum(p.probability for p in potentials), 1, abs_tol=1e-9):
            raise ValueError(f'Invalid distribution for line {line}')


def cubes_for_probability(probability_per_cube, target_probability):
    """Independent-roll estimate; identical-result rerolls are not modeled."""
    if not 0 < probability_per_cube < 1:
        raise ValueError('probability_per_cube must be between 0 and 1')
    if not 0 < target_probability < 1:
        raise ValueError('target_probability must be between 0 and 1')
    return math.ceil(math.log1p(-target_probability) / math.log1p(-probability_per_cube))


def print_result(label, probability):
    print(label)
    print(f'Probability: {probability:.10f}')
    print(f'Percent:     {probability * 100:.6f}%')
    if probability > 0:
        print(f'Approx.:     1 in {1 / probability:,.0f}')


POTENTIALS_BY_LINE = get_potentials_by_line()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--equipment', choices=EQUIPMENT_TYPES, default='hat')
    parser.add_argument('--level', type=int, choices=SUPPORTED_LEVELS, default=150)
    parser.add_argument('--cube', choices=CUBE_TYPES, default='black')
    parser.add_argument('--effect', choices=EFFECTS, default='STR_PCT')
    parser.add_argument('--target', type=float, default=30)
    args = parser.parse_args()
    print_result(f'{args.cube} / Legendary {args.equipment} / level {args.level}: '
        f'{args.effect} >= {args.target}', probability_at_least(args.effect, args.target,
        equipment_type=args.equipment, level=args.level, cube_type=args.cube))
