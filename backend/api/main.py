"""HTTP interface for the bundled potential calculator.

Run from the repository root: python -m uvicorn backend.api.main:app --reload
"""
from typing import Annotated, Literal
from dataclasses import asdict
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.calc import maplestory_potential as calculator
from backend.calc import maplestory_flames as flames
from backend.calc import starforce_calculator as starforce
from backend.calc import equipment_upgrade
from backend.examples.starforce_strategies import analyze_strategies

app = FastAPI(title='MapleStory Potential Calculator', version='0.1.0')


class RequestModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class StrategyRequest(RequestModel):
    item_level: int = Field(ge=1, le=300, strict=True)
    start_star: int = Field(ge=0, le=29, strict=True)
    target_star: int = Field(ge=1, le=30, strict=True)
    replacement_cost_mesos: float = Field(default=0, ge=0, le=1e15, strict=True, allow_inf_nan=False)

    @model_validator(mode='after')
    def increasing_stars(self):
        if self.target_star <= self.start_star:
            raise ValueError('Target stars must exceed starting stars.')
        return self


@lru_cache(maxsize=32)
def cached_strategies(level, start, target, spare_value):
    return analyze_strategies(level, start, target, spare_value)


@app.post('/api/starforce-strategies')
def starforce_strategies(request: StrategyRequest):
    return cached_strategies(request.item_level, request.start_star,
                             request.target_star, request.replacement_cost_mesos)


class PotentialTarget(RequestModel):
    effect: str
    target: float = Field(ge=0, allow_inf_nan=False, strict=True)

    @field_validator('effect')
    @classmethod
    def supported_effect(cls, value):
        if value not in calculator.EFFECTS:
            raise ValueError(f'effect must be one of {calculator.EFFECTS}')
        return value


class CalculationRequest(RequestModel):
    equipment_type: str = 'hat'
    level: int = Field(default=150, strict=True)
    cube_type: str = 'black'
    targets: list[PotentialTarget] = Field(min_length=1, max_length=len(calculator.EFFECTS))
    percentiles: list[Annotated[float, Field(gt=0, lt=1, allow_inf_nan=False, strict=True)]] = Field(
        default_factory=lambda: [0.5, 0.75, 0.9, 0.95, 0.99], max_length=20)


class CubeEstimate(BaseModel):
    target_probability: float
    cubes: int | None


class CalculationResult(BaseModel):
    probability: float
    percentage: float
    one_in: float | None
    cube_estimates: list[CubeEstimate]


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/options')
def options():
    """Supported choices; some equipment/level pairs have no published table."""
    return {
        'equipment_types': calculator.EQUIPMENT_TYPES,
        'levels': calculator.SUPPORTED_LEVELS,
        'cube_types': calculator.CUBE_TYPES,
        'effects': calculator.EFFECTS,
    }


@app.get('/api/item-options')
def item_options(
    level: int,
    potential_equipment_type: str | None = None,
    flame_equipment_type: str | None = None,
    cube_type: str = 'black',
    boss_equipment: bool = True,
    offense_stat: str = 'ATT',
    base_weapon_offense: Annotated[float, Field(gt=0, allow_inf_nan=False)] | None = None,
):
    """Return the potential effects and flame options available for one item."""
    if type(level) is not int or level <= 0:
        raise HTTPException(status_code=422, detail='level must be a positive integer')
    if cube_type not in calculator.CUBE_TYPES:
        raise HTTPException(status_code=422, detail=f'cube_type must be one of {calculator.CUBE_TYPES}')
    if potential_equipment_type and potential_equipment_type not in calculator.EQUIPMENT_TYPES:
        raise HTTPException(
            status_code=422, detail=f'potential_equipment_type must be one of {calculator.EQUIPMENT_TYPES}'
        )
    if flame_equipment_type and flame_equipment_type not in ('armor', 'weapon'):
        raise HTTPException(status_code=422, detail="flame_equipment_type must be 'armor' or 'weapon'")

    potential = {'available': False, 'effects': [], 'values_by_line': []}
    if potential_equipment_type and level in calculator.SUPPORTED_LEVELS:
        try:
            table = calculator.get_potentials_by_line(potential_equipment_type, level, cube_type)
        except ValueError as error:
            if not str(error).startswith('Nexon lists no equipment/probability table'):
                raise HTTPException(status_code=422, detail=str(error)) from error
        else:
            effects = {
                effect for rows in table.values() for option in rows for effect in option.effects
            }
            if any('올스탯' in option.name for rows in table.values() for option in rows):
                effects.add('ALL_STAT_PCT')
            ordered_effects = [effect for effect in calculator.EFFECTS if effect in effects]
            if 'ALL_STAT_PCT' in effects:
                ordered_effects.insert(4, 'ALL_STAT_PCT')
            values_by_line = []
            for line, rows in table.items():
                line_values = {}
                for option in rows:
                    if '올스탯' in option.name:
                        all_stat_value = next(iter(option.effects.values()), None)
                        if all_stat_value is not None:
                            line_values.setdefault('ALL_STAT_PCT', set()).add(all_stat_value)
                        continue
                    for effect, value in option.effects.items():
                        line_values.setdefault(effect, set()).add(value)
                values_by_line.append({
                    'line': line,
                    'values': {
                        effect: sorted(values)
                        for effect, values in line_values.items()
                    },
                })
            potential = {
                'available': True,
                'effects': ordered_effects,
                'values_by_line': values_by_line,
            }

    flame_options = []
    flame_stages = []
    flame_tier_ranges = {}
    flame_values = []
    if flame_equipment_type:
        try:
            flame_options = list(flames.eligible_option_types(flame_equipment_type, level))
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        if offense_stat not in ('ATT', 'MATT'):
            raise HTTPException(status_code=422, detail="offense_stat must be 'ATT' or 'MATT'")
        if flame_equipment_type == 'weapon' and (
            base_weapon_offense is None or base_weapon_offense <= 0
        ):
            raise HTTPException(
                status_code=422, detail='Weapon flame values require positive base_weapon_offense'
            )

        tier_modifier = 2 if boss_equipment else 0
        flame_tier_ranges = {
            flame_type: [
                min(tiers) + tier_modifier,
                max(tiers) + tier_modifier,
            ]
            for flame_type, tiers in flames.FLAME_TIER_PROBABILITIES.items()
        }
        flame_stages = sorted({
            stage
            for minimum, maximum in flame_tier_ranges.values()
            for stage in range(minimum, maximum + 1)
        })
        config = flames.FlameConfig(
            equipment_level=level,
            equipment_type=flame_equipment_type,
            boss_equipment=boss_equipment,
            flame_type='black',
            main_stat='STR',
            offense_stat=offense_stat,
            base_weapon_offense=base_weapon_offense,
        )
        for option in flame_options:
            if flame_equipment_type == 'weapon' and option in ('ATT', 'MATT') and option != offense_stat:
                continue
            values_by_stage = []
            for stage in flame_stages:
                if option == 'LEVEL_REDUCTION':
                    values = {option: float(-5 * stage)}
                elif option == 'DEF':
                    values = {option: float(flames.single_stat_coefficient(level) * stage)}
                elif option in ('MOVE_SPEED', 'JUMP', 'DAMAGE_PCT'):
                    values = {option: float(stage)}
                else:
                    values = flames.option_values(option, stage, config)
                values_by_stage.append({
                    'stage': stage,
                    'values': [{'stat': stat, 'value': value} for stat, value in values.items()],
                })
            flame_values.append({'option': option, 'values': values_by_stage})

    return {
        'potential': potential,
        'flame_options': flame_options,
        'flame_stages': flame_stages,
        'flame_tier_ranges': flame_tier_ranges,
        'flame_values': flame_values,
    }


@app.post('/api/probability', response_model=CalculationResult)
def probability(request: CalculationRequest):
    """Probability that all minimum targets are met on one roll.

    Cooldown targets are positive seconds of reduction. Cube estimates assume
    independent rolls. Impossible targets return null one_in and cube counts.
    """
    pairs = [value for target in request.targets for value in (target.effect, target.target)]
    try:
        chance = calculator.probability_at_least(
            *pairs, equipment_type=request.equipment_type,
            level=request.level, cube_type=request.cube_type)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    # Floating-point summation can put an otherwise certain result just above 1.
    chance = min(1.0, max(0.0, chance))
    estimates = [CubeEstimate(
        target_probability=percentile,
        cubes=(None if chance == 0 else 1 if chance == 1 else
               calculator.cubes_for_probability(chance, percentile)),
    ) for percentile in request.percentiles]
    return CalculationResult(probability=chance, percentage=chance * 100,
                             one_in=1 / chance if chance else None,
                             cube_estimates=estimates)


class FlameWeightsRequest(RequestModel):
    all_stat_pct_value: float
    secondary_stat_value: float = Field(ge=0, allow_inf_nan=False)
    attack_value: float
    boss_damage_pct_value: float = Field(default=0, ge=0, allow_inf_nan=False)


class FlameConfigRequest(RequestModel):
    equipment_level: int
    equipment_type: str
    boss_equipment: bool
    flame_type: str
    main_stat: str | Annotated[tuple[Literal['STR', 'DEX', 'INT', 'LUK'], ...], Field(min_length=1, max_length=3)]
    secondary_stats: tuple[str, ...]
    offense_stat: str
    weights: FlameWeightsRequest
    base_weapon_offense: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    weapon_offense_by_stage: dict[int, Annotated[float, Field(ge=0, allow_inf_nan=False)]] | None = None


class FlameProbabilityRequest(RequestModel):
    config: FlameConfigRequest
    target_score: float = Field(allow_inf_nan=False)


class FlameProbabilityResult(BaseModel):
    target_score: float
    probability: float
    percentage: float
    one_in: float | None


class StarForceEstimateRequest(RequestModel):
    replacement_cost_mesos: float = Field(default=0, ge=0, allow_inf_nan=False, strict=True)
    percentiles: list[Annotated[float, Field(gt=0, lt=1, allow_inf_nan=False, strict=True)]] = Field(
        default_factory=list, max_length=20)
    item_level: int = Field(gt=0, strict=True)
    start_star: int = Field(ge=0, le=29, strict=True)
    target_star: int = Field(ge=1, le=30, strict=True)
    mode_15_17: int = Field(default=1, ge=1, le=3, strict=True)
    mode_18_21: int = Field(default=1, ge=1, le=4, strict=True)
    boom_reset_star: int | None = Field(default=None, ge=0, le=29, strict=True)
    mode_by_star: dict[int, Annotated[int, Field(strict=True)]] = Field(default_factory=dict)
    safeguard_15_17: bool = Field(default=False, strict=True)
    safeguard_by_star: dict[int, Annotated[bool, Field(strict=True)]] = Field(default_factory=dict)
    shining_starforce_sunday: bool = Field(default=False, strict=True)
    mvp_rank: Literal['none', 'silver', 'gold', 'diamond_plus'] = 'none'
    superior_item: bool = Field(default=False, strict=True)


class AttemptEstimate(BaseModel):
    target_probability: float
    attempts: int | None


class MesoEstimate(BaseModel):
    target_probability: float
    mesos: int | None


class StarForceEstimateResult(BaseModel):
    expected_replacement_cost: float
    expected_cost: float
    expected_attempts: float
    expected_booms: float
    attempt_estimates: list[AttemptEstimate] = Field(default_factory=list)
    meso_estimates: list[MesoEstimate] = Field(default_factory=list)


class UpgradeFlameWeightsRequest(RequestModel):
    all_stat_pct_value: float = Field(ge=0, allow_inf_nan=False)
    secondary_stat_value: float = Field(ge=0, allow_inf_nan=False)
    attack_value: float = Field(ge=0, allow_inf_nan=False)
    boss_damage_pct_value: float = Field(ge=0, allow_inf_nan=False)


class UpgradePotentialWeightsRequest(RequestModel):
    base_stat_pct_value: float = Field(ge=0, allow_inf_nan=False)
    attack_pct_value: float = Field(ge=0, allow_inf_nan=False)
    crit_damage_pct_value: float = Field(ge=0, allow_inf_nan=False)


class CurrentPotentialLine(RequestModel):
    effect: str
    value: float = Field(allow_inf_nan=False)

    @field_validator('effect')
    @classmethod
    def supported_effect(cls, value):
        if value not in (*calculator.EFFECTS, 'ALL_STAT_PCT'):
            raise ValueError('Unknown potential effect.')
        return value


class CurrentFlameLine(RequestModel):
    option: str
    stage: int = Field(ge=1, le=10, strict=True)

    @field_validator('option')
    @classmethod
    def supported_option(cls, value):
        if value not in (*flames.ARMOR_OPTION_TYPES, *flames.WEAPON_OPTION_TYPES):
            raise ValueError('Unknown flame option.')
        return value


class UpgradeEquipmentRequest(RequestModel):
    minimum_cooldown_seconds: int = Field(default=0, ge=0, le=6, strict=True)

    @model_validator(mode='after')
    def cooldown_hat_only(self):
        if self.minimum_cooldown_seconds and (self.slot != 'hat' or self.potential_equipment_type != 'hat'):
            raise ValueError('A cooldown minimum is only supported for hats.')
        return self
    replacement_cost_mesos: float | None = Field(default=None, ge=0, allow_inf_nan=False, strict=True)
    safeguard_by_star: dict[int, Annotated[bool, Field(strict=True)]] = Field(default_factory=dict)

    @field_validator('safeguard_by_star')
    @classmethod
    def supported_starforce_safeguards(cls, value):
        if any(star not in (15, 16, 17) for star in value):
            raise ValueError('Safeguard is only available from 15 to 17 stars.')
        return value

    mode_by_star: dict[int, Annotated[int, Field(strict=True)]] = Field(default_factory=dict)

    @field_validator('mode_by_star')
    @classmethod
    def supported_starforce_modes(cls, value):
        for star, mode in value.items():
            if star not in range(15, 22) or mode not in (range(1, 4) if star <= 17 else range(1, 5)):
                raise ValueError('Invalid per-star enhancement mode.')
        return value

    name: str = Field(min_length=1)
    slot: str = Field(min_length=1)
    equipment_level: int = Field(gt=0, strict=True)
    equipment_type: Literal['armor', 'weapon']
    potential_equipment_type: str | None = None
    current_star_force: int = Field(ge=0, le=30, strict=True)
    max_star_force: int | None = Field(default=None, ge=0, le=30, strict=True)
    current_potential: list[CurrentPotentialLine] = Field(default_factory=list, max_length=3)
    current_flames: list[CurrentFlameLine] = Field(default_factory=list, max_length=4)
    boss_equipment: bool = False
    base_weapon_offense: float | None = Field(default=None, gt=0, allow_inf_nan=False)

    @field_validator('potential_equipment_type')
    @classmethod
    def supported_potential_type(cls, value):
        if value is not None and value not in calculator.EQUIPMENT_TYPES:
            raise ValueError(f'potential_equipment_type must be one of {calculator.EQUIPMENT_TYPES}')
        return value


class EquipmentUpgradePlanRequest(RequestModel):
    categories: list[Literal['starforce', 'flames', 'potential']] = Field(
        default_factory=lambda: ['starforce', 'flames', 'potential'], min_length=1, max_length=3)
    main_stat: Literal['STR', 'DEX', 'INT', 'LUK', 'HP'] | Annotated[
        tuple[Literal['STR', 'DEX', 'INT', 'LUK'], ...], Field(min_length=1, max_length=3)]
    secondary_stats: tuple[Literal['STR', 'DEX', 'INT', 'LUK', 'HP'], ...] = Field(max_length=3)
    offense_stat: Literal['ATT', 'MATT']
    cube_type: Literal['red', 'black'] = 'black'
    flame_weights: UpgradeFlameWeightsRequest
    potential_weights: UpgradePotentialWeightsRequest
    shining_starforce_sunday: bool = Field(default=False, strict=True)
    mvp_rank: Literal['none', 'silver', 'gold', 'diamond_plus'] = 'none'
    equipment: list[UpgradeEquipmentRequest] = Field(min_length=1, max_length=40)

    @model_validator(mode='after')
    def distinct_stats(self):
        if len(set(self.secondary_stats)) != len(self.secondary_stats):
            raise ValueError('secondary_stats must be distinct.')
        main_stats = flames.primary_stats(self.main_stat)
        if len(set(main_stats)) != len(main_stats):
            raise ValueError('primary stats must be distinct.')
        if set(main_stats).intersection(self.secondary_stats):
            raise ValueError('main_stat must not appear in secondary_stats.')
        return self


@app.post('/api/flame-probability', response_model=FlameProbabilityResult)
def flame_probability(request: FlameProbabilityRequest):
    """Probability of meeting the target flame score on one roll."""
    data = request.config
    try:
        config = flames.FlameConfig(
            equipment_level=data.equipment_level,
            equipment_type=data.equipment_type,
            boss_equipment=data.boss_equipment,
            flame_type=data.flame_type,
            main_stat=data.main_stat,
            secondary_stats=data.secondary_stats,
            offense_stat=data.offense_stat,
            weights=flames.ScoreWeights(**data.weights.model_dump()),
            base_weapon_offense=data.base_weapon_offense,
            weapon_offense_by_stage=data.weapon_offense_by_stage,
        )
        chance = flames.FlameProbabilityEngine(config).probability_at_least(
            request.target_score
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    chance = min(1.0, max(0.0, chance))
    return FlameProbabilityResult(
        target_score=request.target_score,
        probability=chance,
        percentage=chance * 100,
        one_in=1 / chance if chance else None,
    )


@app.get('/api/starforce-costs')
def starforce_costs(
    level: Annotated[int, Field(gt=0)],
    shining_starforce_sunday: bool = False,
    mvp_rank: Literal['none', 'silver', 'gold', 'diamond_plus'] = 'none',
    superior_item: bool = False,
):
    """Return per-tap costs and outcome rates by star and Enhancement Mode."""
    try:
        base_costs = starforce.starforce_costs_by_star(level)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return {
        'item_level': level,
        'shining_starforce_sunday': shining_starforce_sunday,
        'mvp_rank': mvp_rank,
        'superior_item': superior_item,
        'costs_by_star': [
            {
                'star': current_star,
                'base_cost': base_cost,
                'mode_rates': {
                    str(mode): (
                        None if current_star in (15, 16, 17) and mode == 4
                        else asdict(starforce.attempt_rates(
                            current_star,
                            mode,
                            shining_starforce_sunday=shining_starforce_sunday,
                        ))
                    )
                    for mode in range(1, 5)
                },
                'safeguard_rates': (
                    asdict(starforce.attempt_rates(
                        current_star,
                        safeguard=True,
                        shining_starforce_sunday=shining_starforce_sunday,
                    ))
                    if current_star in (15, 16, 17) else None
                ),
                'mode_costs': {
                    str(mode): (
                        int(base_cost * starforce.enhancement_mode_multiplier(
                            current_star,
                            1 if current_star in (15, 16, 17) and mode == 4 else mode,
                            safeguard=current_star in (15, 16, 17) and mode == 4,
                            shining_starforce_sunday=shining_starforce_sunday,
                            mvp_rank=mvp_rank,
                            superior_item=superior_item,
                        ))
                    )
                    for mode in range(1, 5)
                },
            }
            for current_star, base_cost in base_costs.items()
        ],
    }


@app.post('/api/starforce-estimate', response_model=StarForceEstimateResult)
def starforce_estimate(request: StarForceEstimateRequest):
    """Estimate expected mesos, attempts, and booms to reach a target star."""
    try:
        estimate = starforce.estimate_starforce(
            item_level=request.item_level,
            start_star=request.start_star,
            target_star=request.target_star,
            mode_15_17=request.mode_15_17,
            mode_18_21=request.mode_18_21,
            boom_reset_star=request.boom_reset_star,
            mode_by_star=request.mode_by_star,
            safeguard_15_17=request.safeguard_15_17,
            safeguard_by_star=request.safeguard_by_star,
            percentiles=request.percentiles,
            replacement_cost_mesos=request.replacement_cost_mesos,
            shining_starforce_sunday=request.shining_starforce_sunday,
            mvp_rank=request.mvp_rank,
            superior_item=request.superior_item,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return StarForceEstimateResult(
        expected_replacement_cost=estimate.expected_replacement_cost,
        expected_cost=estimate.expected_cost,
        expected_attempts=estimate.expected_attempts,
        expected_booms=estimate.expected_booms,
        attempt_estimates=estimate.attempt_estimates,
        meso_estimates=estimate.meso_estimates,
    )


@app.post('/api/equipment-upgrade-plan')
def equipment_upgrade_plan(request: EquipmentUpgradePlanRequest):
    """Rank equipped items by current score, expected gain, and meso efficiency."""
    try:
        return equipment_upgrade.equipment_upgrade_plan(request.model_dump())
    except (ValueError, KeyError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
