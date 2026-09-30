"""HTTP interface for the bundled potential calculator.

Run from the repository root: python -m uvicorn api:app --reload
"""
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

import maplestory_potential as calculator
import maplestory_flames as flames

app = FastAPI(title='MapleStory Potential Calculator', version='0.1.0')


class RequestModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


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
    secondary_stat_per_main: float
    attack_value: float
    boss_damage_pct_value: float = Field(default=0, ge=0, allow_inf_nan=False)


class FlameConfigRequest(RequestModel):
    equipment_level: int
    equipment_type: str
    boss_equipment: bool
    flame_type: str
    main_stat: str
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
