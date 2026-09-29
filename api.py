"""HTTP interface for the bundled potential calculator.

Run from the repository root: python -m uvicorn api:app --reload
"""
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

import maplestory_potential as calculator


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
