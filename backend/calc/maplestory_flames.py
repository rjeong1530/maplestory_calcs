from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations, product
from math import ceil, comb, fsum, log, isfinite
from typing import Dict, Iterable, Literal, Mapping, Tuple

Stat = Literal['STR', 'DEX', 'INT', 'LUK']
EquipmentType = Literal['armor', 'weapon']
OffenseStat = Literal['ATT', 'MATT']
FlameType = Literal['powerful', 'black', 'abyssal']

# Raw KMS additional-option stage probabilities.
# Boss equipment receives +2 stages after selection.
FLAME_TIER_PROBABILITIES: Dict[FlameType, Dict[int, float]] = {
    'powerful': {1: 0.20, 2: 0.30, 3: 0.36, 4: 0.14},
    'black': {2: 0.29, 3: 0.45, 4: 0.25, 5: 0.01},
    'abyssal': {3: 0.63, 4: 0.34, 5: 0.03},
}

# Rebirth Flame option-count distribution for non-boss equipment.
# Boss equipment always gets 4 options.
NON_BOSS_OPTION_COUNT_PROBABILITIES: Dict[int, float] = {
    1: 0.40,
    2: 0.40,
    3: 0.16,
    4: 0.04,
}

ARMOR_OPTION_TYPES: Tuple[str, ...] = (
    'STR', 'DEX', 'INT', 'LUK',
    'STR+DEX', 'STR+INT', 'STR+LUK',
    'DEX+INT', 'DEX+LUK', 'INT+LUK',
    'MAX_HP', 'MAX_MP', 'LEVEL_REDUCTION', 'DEF',
    'ATT', 'MATT', 'MOVE_SPEED', 'JUMP', 'ALL_STAT_PCT',
)

WEAPON_OPTION_TYPES: Tuple[str, ...] = (
    'STR', 'DEX', 'INT', 'LUK',
    'STR+DEX', 'STR+INT', 'STR+LUK',
    'DEX+INT', 'DEX+LUK', 'INT+LUK',
    'MAX_HP', 'MAX_MP', 'LEVEL_REDUCTION', 'DEF',
    'ATT', 'MATT', 'BOSS_DAMAGE_PCT', 'DAMAGE_PCT', 'ALL_STAT_PCT',
)


@dataclass(frozen=True)
class ScoreWeights:
    '''
    Flame-score conversions.

    Defaults:
      1 main stat        = 1 point
      1 secondary stat  = 0.1 points
      1% all stat       = 10 points
      1 ATT/MATT        = 3 points
      1% boss damage    = 10 points
    '''
    all_stat_pct_value: float = 10.0
    secondary_stat_value: float = 0.1
    attack_value: float = 3.0
    boss_damage_pct_value: float = 10.0

    def secondary_value(self, amount: float) -> float:
        if self.secondary_stat_value < 0:
            raise ValueError('secondary_stat_value must be >= 0')
        return amount * self.secondary_stat_value


@dataclass(frozen=True)
class FlameConfig:
    equipment_level: int
    equipment_type: EquipmentType
    boss_equipment: bool
    flame_type: FlameType
    main_stat: Stat | Tuple[Stat, ...]
    secondary_stats: Tuple[Stat, ...] = ('DEX',)
    offense_stat: OffenseStat = 'ATT'
    weights: ScoreWeights = field(default_factory=ScoreWeights)

    # For weapons, provide the CLEAN base ATT/MATT before flames.
    # The engine will calculate the weapon flame ATT/MATT automatically.
    #
    # Example: Arcane Shade 2H Sword (Lv.200) -> base_weapon_offense=295
    base_weapon_offense: float | None = None

    # Optional manual override for special weapons.
    # Map FINAL stage -> actual ATT/MATT flame amount.
    # Example shape: {3: 54, 4: 78, 5: 108, 6: 142, 7: 182}
    weapon_offense_by_stage: Mapping[int, float] | None = None


@dataclass(frozen=True)
class FlameOptionResult:
    option_type: str
    stage: int
    score: float
    values: Mapping[str, float]


@dataclass(frozen=True)
class FlameOutcome:
    options: Tuple[FlameOptionResult, ...]
    score: float
    probability: float


def eligible_option_types(equipment_type: EquipmentType, equipment_level: int) -> Tuple[str, ...]:
    if equipment_level <= 0:
        raise ValueError('equipment_level must be positive')

    if equipment_type == 'armor':
        options = list(ARMOR_OPTION_TYPES)
        if equipment_level < 60:
            options.remove('ATT')
            options.remove('MATT')
        if equipment_level < 70:
            options.remove('ALL_STAT_PCT')
        return tuple(options)

    if equipment_type == 'weapon':
        options = list(WEAPON_OPTION_TYPES)
        if equipment_level < 90:
            options.remove('BOSS_DAMAGE_PCT')
        return tuple(options)

    raise ValueError(f'Unknown equipment_type: {equipment_type}')


def single_stat_coefficient(level: int) -> int:
    # Standard level formula, capped at 12 for current 250+ equipment.
    return min(level // 20 + 1, 12)


def dual_stat_coefficient(level: int) -> int:
    return level // 40 + 1


def hp_mp_coefficient(level: int) -> int:
    # Current 250+ coefficient cap is 700.
    return min((level // 10) * 30, 700)



def weapon_level_factor(level: int) -> int:
    """
    Return the weapon flame level factor.

    Relevant high-level brackets:
      Lv.120-159 -> 4
      Lv.160-199 -> 5
      Lv.200-239 -> 6
      Lv.240+    -> 7 (capped)

    This reproduces the standard KMS weapon additional-option formula.
    """
    if level <= 0:
        raise ValueError('level must be positive')
    return min(level // 40 + 1, 7)


def weapon_flame_multiplier(
    level: int,
    stage: int,
    flame_advantaged: bool = True,
) -> float:
    """
    Return the ATT/MATT flame increase as a decimal multiplier.

    For flame-advantaged (boss) weapons:
        factor * stage * 1.1 ** (stage - 3) percent

    For non-flame-advantaged weapons:
        factor * stage * 1.1 ** (stage - 1) percent

    Example for a Lv.150 flame-advantaged weapon:
      Stage 3 -> 12.0000%
      Stage 4 -> 17.6000%
      Stage 5 -> 24.2000%
      Stage 6 -> 31.9440%
      Stage 7 -> 40.9948%
    """
    factor = weapon_level_factor(level)
    exponent = stage - 3 if flame_advantaged else stage - 1

    if exponent < 0:
        raise ValueError(
            f'Invalid final stage {stage} for '
            f'{"flame-advantaged" if flame_advantaged else "non-flame-advantaged"} weapon'
        )

    percent = factor * stage * (1.1 ** exponent)
    return percent / 100.0


def weapon_flame_offense(
    level: int,
    base_offense: float,
    stage: int,
    flame_advantaged: bool = True,
) -> int:
    """Calculate the actual weapon ATT/MATT flame amount for one stage."""
    if base_offense <= 0:
        raise ValueError('base_offense must be > 0')

    multiplier = weapon_flame_multiplier(
        level=level,
        stage=stage,
        flame_advantaged=flame_advantaged,
    )
    return ceil(base_offense * multiplier)


def generate_weapon_offense_by_stage(
    level: int,
    base_offense: float,
    flame_advantaged: bool = True,
    stages: Iterable[int] | None = None,
) -> Dict[int, int]:
    """
    Generate {final_stage: flame ATT/MATT}.

    Defaults:
      flame-advantaged -> stages 3 through 7
      non-advantaged   -> stages 1 through 5
    """
    if stages is None:
        stages = range(3, 8) if flame_advantaged else range(1, 6)

    return {
        stage: weapon_flame_offense(
            level=level,
            base_offense=base_offense,
            stage=stage,
            flame_advantaged=flame_advantaged,
        )
        for stage in stages
    }


def final_stage(raw_stage: int, boss_equipment: bool) -> int:
    return raw_stage + 2 if boss_equipment else raw_stage


def option_values(option_type: str, stage: int, config: FlameConfig) -> Dict[str, float]:
    level = config.equipment_level
    single = single_stat_coefficient(level) * stage
    dual = dual_stat_coefficient(level) * stage

    if option_type in {'STR', 'DEX', 'INT', 'LUK'}:
        return {option_type: float(single)}

    if '+' in option_type:
        left, right = option_type.split('+')
        if left in {'STR', 'DEX', 'INT', 'LUK'} and right in {'STR', 'DEX', 'INT', 'LUK'}:
            return {left: float(dual), right: float(dual)}

    if option_type == 'MAX_HP':
        return {'MAX_HP': float(hp_mp_coefficient(level) * stage)}

    if option_type == 'MAX_MP':
        return {'MAX_MP': float(hp_mp_coefficient(level) * stage)}

    if option_type == 'ALL_STAT_PCT':
        return {'ALL_STAT_PCT': float(stage)}

    if option_type in {'ATT', 'MATT'}:
        if config.equipment_type == 'weapon' and option_type == config.offense_stat:
            # Manual stage table has priority, which is useful for special weapons.
            if config.weapon_offense_by_stage is not None:
                if stage not in config.weapon_offense_by_stage:
                    raise ValueError(
                        f'Missing weapon offense value for final stage {stage}.'
                    )
                return {
                    option_type: float(config.weapon_offense_by_stage[stage])
                }

            # Normal weapons can be calculated from their clean base ATT/MATT.
            if config.base_weapon_offense is None:
                raise ValueError(
                    'Weapon configs require either base_weapon_offense or '
                    'weapon_offense_by_stage.'
                )

            amount = weapon_flame_offense(
                level=config.equipment_level,
                base_offense=config.base_weapon_offense,
                stage=stage,
                flame_advantaged=config.boss_equipment,
            )
            return {option_type: float(amount)}

        if config.equipment_type == 'armor':
            return {option_type: float(stage)}

        # Wrong offensive stat for the character (e.g. MATT on an ATT class).
        return {option_type: 0.0}

    if option_type == 'BOSS_DAMAGE_PCT':
        return {'BOSS_DAMAGE_PCT': float(2 * stage)}

    # These still occupy a flame-option slot but score 0 under this formula.
    if option_type in {
        'LEVEL_REDUCTION', 'DEF', 'MOVE_SPEED', 'JUMP',
        'DAMAGE_PCT',
    }:
        return {option_type: 0.0}

    raise ValueError(f'Unhandled option type: {option_type}')


def primary_stats(main_stat: str | Tuple[str, ...]) -> Tuple[str, ...]:
    return (main_stat,) if isinstance(main_stat, str) else tuple(main_stat)


def score_values(values: Mapping[str, float], config: FlameConfig) -> float:
    main_stats = primary_stats(config.main_stat)
    score = sum(values.get(stat, 0.0) for stat in main_stats)

    for secondary in config.secondary_stats:
        if secondary not in main_stats:
            score += config.weights.secondary_value(values.get(secondary, 0.0))

    score += values.get('ALL_STAT_PCT', 0.0) * config.weights.all_stat_pct_value
    score += values.get(config.offense_stat, 0.0) * config.weights.attack_value
    score += values.get('BOSS_DAMAGE_PCT', 0.0) * config.weights.boss_damage_pct_value
    if not isfinite(score):
        raise ValueError('Flame scores exceed the supported numeric range.')
    return score


def score_option(option_type: str, stage: int, config: FlameConfig) -> FlameOptionResult:
    values = option_values(option_type, stage, config)
    return FlameOptionResult(
        option_type=option_type,
        stage=stage,
        score=score_values(values, config),
        values=values,
    )


class FlameProbabilityEngine:
    '''Exact KMS flame-score probability enumerator.'''

    def __init__(self, config: FlameConfig):
        self.config = config
        self.option_pool = eligible_option_types(config.equipment_type, config.equipment_level)
        if config.flame_type not in FLAME_TIER_PROBABILITIES:
            raise ValueError('Unknown flame type.')
        self.raw_tier_probabilities = FLAME_TIER_PROBABILITIES[config.flame_type]
        self._validate()

    def _validate(self) -> None:
        valid_stats = {'STR', 'DEX', 'INT', 'LUK', 'MAX_HP', 'MAX_MP'}
        main_stats = primary_stats(self.config.main_stat)
        if any(stat not in valid_stats for stat in (*main_stats, *self.config.secondary_stats)):
            raise ValueError('Unknown flame scoring stat.')
        if len(set(self.config.secondary_stats)) != len(self.config.secondary_stats):
            raise ValueError('secondary_stats must be distinct')
        if self.config.offense_stat not in ('ATT', 'MATT'):
            raise ValueError('Unknown offense stat.')
        if any(not isfinite(value) or value < 0 for value in vars(self.config.weights).values()):
            raise ValueError('Flame weights must be finite and nonnegative.')
        if not main_stats or len(set(main_stats)) != len(main_stats):
            raise ValueError('primary stats must be nonempty and distinct')
        if set(main_stats).intersection(self.config.secondary_stats):
            raise ValueError('main_stat should not also appear in secondary_stats')

        if (
            self.config.equipment_type == 'weapon'
            and self.config.base_weapon_offense is None
            and self.config.weapon_offense_by_stage is None
        ):
            raise ValueError(
                'Weapon configs require either base_weapon_offense or '
                'weapon_offense_by_stage.'
            )

        total = sum(self.raw_tier_probabilities.values())
        if abs(total - 1.0) > 1e-12:
            raise ValueError(f'Tier probabilities sum to {total}, not 1')

    def option_count_probabilities(self) -> Dict[int, float]:
        if self.config.boss_equipment:
            return {4: 1.0}
        return NON_BOSS_OPTION_COUNT_PROBABILITIES.copy()

    def iter_outcomes(self) -> Iterable[FlameOutcome]:
        pool = self.option_pool

        for option_count, count_probability in self.option_count_probabilities().items():
            type_probability = 1.0 / comb(len(pool), option_count)

            for chosen_types in combinations(pool, option_count):
                for raw_tiers in product(self.raw_tier_probabilities.items(), repeat=option_count):
                    stage_probability = 1.0
                    scored_options = []

                    for option_type, (raw_stage, raw_stage_probability) in zip(chosen_types, raw_tiers):
                        stage_probability *= raw_stage_probability
                        stage = final_stage(raw_stage, self.config.boss_equipment)
                        scored_options.append(score_option(option_type, stage, self.config))

                    probability = count_probability * type_probability * stage_probability
                    total_score = sum(option.score for option in scored_options)

                    yield FlameOutcome(
                        options=tuple(scored_options),
                        score=total_score,
                        probability=probability,
                    )

    def probability_at_least(self, target_score: float) -> float:
        return fsum(
            probability
            for score, probability in self.score_distribution(decimals=None).items()
            if score >= target_score
        )

    def probability_between(self, minimum_score: float, maximum_score: float) -> float:
        if maximum_score < minimum_score:
            raise ValueError('maximum_score must be >= minimum_score')
        return sum(
            outcome.probability
            for outcome in self.iter_outcomes()
            if minimum_score <= outcome.score <= maximum_score
        )

    def score_distribution(self, decimals: int | None = 4) -> Dict[float, float]:
        """Aggregate roll scores; use None to preserve unrounded threshold comparisons."""
        option_count_probabilities = self.option_count_probabilities()
        maximum_count = max(option_count_probabilities)
        distributions: list[Dict[float, float]] = [dict() for _ in range(maximum_count + 1)]
        distributions[0] = {0.0: 1.0}

        for option_index, option_type in enumerate(self.option_pool):
            option_scores: Dict[float, float] = {}
            for raw_stage, stage_probability in self.raw_tier_probabilities.items():
                stage = final_stage(raw_stage, self.config.boss_equipment)
                # Preserve fractional weights until the complete roll is scored.
                score = score_option(option_type, stage, self.config).score
                if decimals is not None:
                    score = round(score, 12)
                option_scores[score] = option_scores.get(score, 0.0) + stage_probability

            previous_count = min(maximum_count - 1, option_index)
            for count in range(previous_count + 1, 0, -1):
                for previous_score, previous_probability in distributions[count - 1].items():
                    for option_score, option_probability in option_scores.items():
                        score = previous_score + option_score
                        if not isfinite(score):
                            raise ValueError('Flame scores exceed the supported numeric range.')
                        if decimals is not None:
                            score = round(score, 12)
                        distributions[count][score] = distributions[count].get(score, 0.0) + (
                            previous_probability * option_probability
                        )

        distribution: Dict[float, float] = {}
        for count, count_probability in option_count_probabilities.items():
            subset_probability = count_probability / comb(len(self.option_pool), count)
            for score, probability in distributions[count].items():
                if decimals is not None:
                    score = round(score, decimals)
                distribution[score] = distribution.get(score, 0.0) + (
                    subset_probability * probability
                )
        return dict(sorted(distribution.items()))

    def top_matching_outcomes(self, target_score: float, limit: int = 20) -> list[FlameOutcome]:
        matches = [o for o in self.iter_outcomes() if o.score >= target_score]
        matches.sort(key=lambda o: o.probability, reverse=True)
        return matches[:limit]

    def total_probability(self) -> float:
        return sum(outcome.probability for outcome in self.iter_outcomes())


def probability_within_rolls(probability_per_roll: float, rolls: int) -> float:
    if not 0.0 <= probability_per_roll <= 1.0:
        raise ValueError('probability_per_roll must be between 0 and 1')
    if rolls < 0:
        raise ValueError('rolls must be >= 0')
    return 1.0 - (1.0 - probability_per_roll) ** rolls


def rolls_for_percentile(probability_per_roll: float, target_probability: float) -> int:
    if not 0.0 < probability_per_roll < 1.0:
        raise ValueError('probability_per_roll must be strictly between 0 and 1')
    if not 0.0 < target_probability < 1.0:
        raise ValueError('target_probability must be strictly between 0 and 1')
    return ceil(log(1.0 - target_probability) / log(1.0 - probability_per_roll))


def describe_outcome(outcome: FlameOutcome) -> str:
    pieces = [
        f'{o.option_type} (stage {o.stage}, score {o.score:g})'
        for o in outcome.options
    ]
    return (
        ' | '.join(pieces)
        + f' -> total {outcome.score:g}'
        + f' -> {outcome.probability * 100:.10f}%'
    )


if __name__ == '__main__':
    config = FlameConfig(
        equipment_level=150,
        equipment_type='armor',
        boss_equipment=True,
        flame_type='black',
        main_stat='STR',
        secondary_stats=('DEX',),
        offense_stat='ATT',
        weights=ScoreWeights(
            all_stat_pct_value=10,
            secondary_stat_value=0.1,
            attack_value=3,
        ),
    )

    engine = FlameProbabilityEngine(config)
    target = 120
    probability = engine.probability_at_least(target)

    print(f'{target}+ flame score')
    print(f'Per roll: {probability * 100:.8f}%')
    if probability > 0:
        print(f'Average: 1 in {1 / probability:,.1f} rolls')
        for percentile in (0.50, 0.75, 0.90, 0.95, 0.99):
            rolls = rolls_for_percentile(probability, percentile)
            print(f'{percentile * 100:.0f}% cumulative chance: {rolls:,} rolls')

    print('\nProbability sanity check:')
    print(engine.total_probability())

    print('\nSome matching outcomes:')
    for outcome in engine.top_matching_outcomes(target_score=target, limit=10):
        print(describe_outcome(outcome))

    # Weapon example:
    # Lv.200 Arcane Shade 2H Sword with 295 clean base ATT.
    #
    # weapon_config = FlameConfig(
    #     equipment_level=200,
    #     equipment_type='weapon',
    #     boss_equipment=True,
    #     flame_type='black',
    #     main_stat='STR',
    #     secondary_stats=('DEX',),
    #     offense_stat='ATT',
    #     base_weapon_offense=295,
    #     weights=ScoreWeights(
    #         all_stat_pct_value=10,
    #         secondary_stat_value=0.1,
    #         attack_value=3,
    #     ),
    # )
    #
    # weapon_engine = FlameProbabilityEngine(weapon_config)
    # print(weapon_engine.probability_at_least(300))
    #
    # print(generate_weapon_offense_by_stage(200, 295, True))
    # # {3: 54, 4: 78, 5: 108, 6: 142, 7: 182}
