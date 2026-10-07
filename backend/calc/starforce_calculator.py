"""Estimate Global MapleStory Star Force costs and outcomes."""
from __future__ import annotations

import argparse
from array import array
from bisect import bisect_left
from dataclasses import dataclass
from math import ceil, fsum, isfinite
from typing import Mapping, Sequence


# Probabilities are percentages supplied for Global MapleStory, including the
# automatic Star Catching success-rate bonus.
BASE_SUCCESS_AND_BOOM: dict[int, tuple[float, float]] = {
    0: (99.75, 0.0),
    1: (94.5, 0.0),
    2: (89.25, 0.0),
    3: (89.25, 0.0),
    4: (84.0, 0.0),
    5: (78.75, 0.0),
    6: (73.5, 0.0),
    7: (68.25, 0.0),
    8: (63.0, 0.0),
    9: (57.75, 0.0),
    10: (52.5, 0.0),
    11: (47.25, 0.0),
    12: (42.0, 0.0),
    13: (36.75, 0.0),
    14: (31.5, 0.0),
    15: (31.5, 2.055),
    16: (31.5, 2.055),
    17: (15.75, 6.74),
    18: (15.75, 6.74),
    19: (15.75, 8.425),
    20: (31.5, 10.275),
    21: (15.75, 12.6375),
    22: (15.75, 16.85),
    23: (10.5, 17.9),
    24: (10.5, 17.9),
    25: (10.5, 17.9),
    26: (7.35, 18.53),
    27: (5.25, 18.95),
    28: (3.15, 19.37),
    29: (1.05, 19.79),
}

# Starting star: mode -> (success %, boom %). Remaining probability maintains
# the current star, as specified in the supplied GMS Enhancement Mode table.
ENHANCEMENT_MODE_RATES: dict[int, dict[int, tuple[float, float]]] = {
    15: {1: (31.5, 2.055), 2: (31.5, 1.37), 3: (31.5, 0.685), 4: (31.5, 0.0)},
    16: {1: (31.5, 2.055), 2: (31.5, 1.37), 3: (31.5, 0.685), 4: (31.5, 0.0)},
    17: {1: (15.75, 6.74), 2: (15.75, 4.2125), 3: (15.75, 1.685), 4: (15.75, 0.0)},
    18: {1: (15.75, 6.74), 2: (12.6, 4.37), 3: (10.5, 1.79), 4: (8.4, 0.0)},
    19: {1: (15.75, 8.425), 2: (12.6, 6.118), 3: (10.5, 3.58), 4: (8.4, 0.0)},
    20: {1: (31.5, 10.275), 2: (26.25, 7.375), 3: (21.0, 3.95), 4: (15.75, 0.0)},
    21: {1: (15.75, 12.6375), 2: (12.6, 8.74), 3: (10.5, 4.475), 4: (8.4, 0.0)},
}

MODE_COST_MULTIPLIERS: dict[int, dict[int, float]] = {
    15: {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.0},
    16: {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.0},
    17: {1: 1.0, 2: 1.5, 3: 2.5, 4: 3.0},
    18: {1: 1.0, 2: 2.0, 3: 3.5, 4: 6.5},
    19: {1: 1.0, 2: 2.0, 3: 3.5, 4: 6.5},
    20: {1: 1.0, 2: 2.0, 3: 3.5, 4: 6.5},
    21: {1: 1.0, 2: 2.0, 3: 3.5, 4: 6.5},
}

MVP_COST_DISCOUNTS: dict[str, float] = {
    'none': 0.0,
    'silver': 0.03,
    'gold': 0.05,
    'diamond_plus': 0.10,
}


@dataclass(frozen=True)
class AttemptRates:
    success: float
    maintain: float
    downgrade: float
    boom: float


@dataclass(frozen=True)
class StarForceEstimate:
    expected_cost: float
    expected_attempts: float
    expected_booms: float
    attempt_estimates: tuple[dict, ...] = ()
    expected_replacement_cost: float = 0
    meso_estimates: tuple[dict, ...] = ()
    budget_distribution: dict | None = None


def _meso_percentiles(edges, start, percentiles, expected_cost, distribution=None):
    """Conservative budget quantiles of a cost-weighted absorbing chain.

    Round each transition's full cost UP to a budget bin, so rounding cannot
    understate the budget. Include replacement spending only on boom edges.
    Bound time/memory; return None when the rounded model exceeds the horizon.
    """
    if not percentiles:
        return ()
    bins = 65536
    size = len(edges)
    # States unreachable from the starting star cannot affect the distribution.
    reachable = {start}
    pending = [start]
    while pending:
        for destination, probability, _ in edges[pending.pop()]:
            if probability and destination < size and destination not in reachable:
                reachable.add(destination)
                pending.append(destination)
    states = sorted(reachable)
    for scale in (2, 4, 8, 16):
        unit = max(1, ceil(expected_cost * scale / bins))
        rounded = [[(dest, probability, max(1, ceil(cost / unit)))
                    for dest, probability, cost in row if probability] for row in edges]
        cdf = {state: array('d', [0.0]) * (bins + 1) for state in states}
        for budget in range(1, bins + 1):
            for state in states:
                total = 0.0
                for dest, probability, cost in rounded[state]:
                    if cost <= budget:
                        total += probability * (1.0 if dest >= size else cdf[dest][budget - cost])
                cdf[state][budget] = min(1.0, total)
        if cdf[start][-1] >= max(percentiles):
            break
    if distribution is not None:
        # Reuse the solved CDF on a bounded 4,097-point interactive grid.
        stride = 16
        distribution.update(
            step_mesos=unit * stride,
            probabilities=list(cdf[start][::stride]),
            mean_success_probability=cdf[start][min(bins, int(expected_cost // unit))],
            rounding_unit_mesos=unit,
            calculation_limit_mesos=bins * unit,
        )
    return tuple({'target_probability': p,
                  'rounding_unit_mesos': unit, 'calculation_limit_mesos': bins * unit,
                  'mesos': bisect_left(cdf[start], p) * unit if cdf[start][-1] >= p else None}
                 for p in percentiles)


def _attempt_percentiles(transitions, start, percentiles):
    """Quantiles of target hitting time, using powers of the transient matrix."""
    if not percentiles:
        return ()
    size = len(transitions)

    def advance(vector, matrix):
        return [fsum(vector[i] * matrix[i][j] for i in range(size)) for j in range(size)]

    initial = [float(i == start) for i in range(size)]
    powers = [transitions]
    # At most 2**52 attempts, so returned counts remain exact in JavaScript.
    while fsum(advance(initial, powers[-1])) > 1 - max(percentiles) and len(powers) < 53:
        matrix = powers[-1]
        powers.append([advance(row, matrix) for row in matrix])
    estimates = []
    for percentile in percentiles:
        threshold = 1 - percentile
        if fsum(advance(initial, powers[-1])) > threshold:
            estimates.append({'target_probability': percentile, 'attempts': None})
            continue
        vector, attempts = initial, 0
        for exponent in range(len(powers) - 1, -1, -1):
            candidate = advance(vector, powers[exponent])
            if fsum(candidate) > threshold:
                vector = candidate
                attempts += 2 ** exponent
        estimates.append({'target_probability': percentile, 'attempts': attempts + 1})
    return tuple(estimates)


def starforce_base_cost(item_level: int, current_star: int) -> int:
    """Return the supplied GMS base cost, rounded to the nearest 100 mesos."""
    if type(item_level) is not int or item_level <= 0:
        raise ValueError('Item level must be a positive integer.')
    if type(current_star) is not int or not 0 <= current_star <= 29:
        raise ValueError('Current Star Force must be between 0 and 29.')

    level = item_level
    star = current_star
    if star <= 9:
        raw = 1000 + level**3 * (star + 1) / 25
    elif star == 10:
        raw = 1000 + level**3 * 11**2.7 / 400
    elif star == 11:
        raw = 1000 + level**3 * 12**2.7 / 220
    elif star == 12:
        raw = 1000 + level**3 * 13**2.7 / 150
    elif star == 13:
        raw = 1000 + level**3 * 14**2.7 / 110
    elif star == 14:
        raw = 1000 + level**3 * 15**2.7 / 75
    elif star in (15, 16):
        raw = 1000 + level**3 * (star + 1)**2.7 / 200
    elif star == 17:
        raw = 1000 + level**3 * 18**2.7 / 150
    elif star == 18:
        raw = 1000 + level**3 * 19**2.7 / 70
    elif star == 19:
        raw = 1000 + level**3 * 20**2.7 / 45
    elif star == 20:
        raw = 1000 + level**3 * 21**2.7 / 200
    elif star == 21:
        raw = 1000 + level**3 * 22**2.7 / 125
    else:
        raw = 1000 + level**3 * (star + 1)**2.7 / 200
    return int(round(raw / 100.0) * 100)


def starforce_costs_by_star(item_level: int) -> dict[int, int]:
    """Return the base cost per tap from each star level, 0★ through 29★."""
    return {
        star: starforce_base_cost(item_level, star)
        for star in range(30)
    }


def boom_recovery_star(destroyed_star: int) -> int:
    """Return the recovered Star Force level for an item destroyed at this star."""
    if type(destroyed_star) is not int or not 0 <= destroyed_star <= 30:
        raise ValueError('Destroyed Star Force must be between 0 and 30.')
    if destroyed_star <= 19:
        return 12
    if destroyed_star == 20:
        return 15
    if destroyed_star <= 22:
        return 17
    if destroyed_star <= 25:
        return 19
    return 20


def enhancement_mode_multiplier(
    star: int,
    mode: int,
    safeguard: bool = False,
    shining_starforce_sunday: bool = False,
    mvp_rank: str = 'none',
    superior_item: bool = False,
) -> float:
    """Return the mode cost multiplier for an attempt from ``star``."""
    if type(mode) is not int or mode not in (1, 2, 3, 4):
        raise ValueError('Enhancement mode must be 1, 2, 3, or 4.')
    if type(star) is not int or star < 0:
        raise ValueError('Star Force must be a nonnegative integer.')
    if type(shining_starforce_sunday) is not bool:
        raise ValueError('shining_starforce_sunday must be a boolean.')
    if not isinstance(mvp_rank, str) or mvp_rank not in MVP_COST_DISCOUNTS:
        raise ValueError('MVP rank must be none, silver, gold, or diamond_plus.')
    if type(superior_item) is not bool:
        raise ValueError('superior_item must be a boolean.')

    if safeguard and 15 <= star <= 17:
        multiplier = 3.0
    elif star in MODE_COST_MULTIPLIERS:
        multiplier = MODE_COST_MULTIPLIERS[star][mode]
    else:
        multiplier = 1.0

    safeguarded = safeguard and 15 <= star <= 17
    mvp_discount = (
        MVP_COST_DISCOUNTS[mvp_rank]
        if star <= 16 and not superior_item else 0.0
    )
    if safeguarded:
        base_discount_multiplier = (
            (0.7 if shining_starforce_sunday else 1.0) * (1 - mvp_discount)
        )
        multiplier = (multiplier - 1) + base_discount_multiplier
    else:
        if shining_starforce_sunday:
            multiplier *= 0.7
        multiplier *= 1 - mvp_discount
    return multiplier


def attempt_rates(
    star: int,
    mode: int = 1,
    safeguard: bool = False,
    shining_starforce_sunday: bool = False,
) -> AttemptRates:
    """Return success, maintain, downgrade, and boom probabilities."""
    if type(star) is not int or star not in BASE_SUCCESS_AND_BOOM:
        raise ValueError('Current Star Force must be between 0 and 29.')
    if type(mode) is not int or mode not in (1, 2, 3, 4):
        raise ValueError('Enhancement mode must be 1, 2, 3, or 4.')
    if type(safeguard) is not bool:
        raise ValueError('Safeguard must be a boolean.')
    if type(shining_starforce_sunday) is not bool:
        raise ValueError('shining_starforce_sunday must be a boolean.')

    if star in ENHANCEMENT_MODE_RATES:
        if safeguard and 15 <= star <= 17:
            mode = 1
        if mode == 4 and 15 <= star <= 17:
            raise ValueError(
                'GMS Enhancement Mode 4 is unavailable for attempts from 15 to 17 stars.'
            )
        success_pct, boom_pct = ENHANCEMENT_MODE_RATES[star][mode]
    else:
        success_pct, boom_pct = BASE_SUCCESS_AND_BOOM[star]

    success = success_pct / 100.0
    boom = boom_pct / 100.0
    if safeguard and 15 <= star <= 17:
        boom = 0.0
    elif shining_starforce_sunday and 15 <= star <= 21:
        boom *= 0.7
    failure = 1.0 - success - boom
    if failure < -1e-12:
        raise ValueError(f'Invalid probability table at {star} stars in mode {mode}.')

    # Non-destructive failures maintain the current star at every level.
    # Only destruction sends the item back to its recovery star.
    return AttemptRates(success, max(0.0, failure), 0.0, boom)


def _solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Solve a small dense system using Gaussian elimination with pivoting."""
    size = len(vector)
    augmented = [row[:] + [value] for row, value in zip(matrix, vector)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-14:
            raise ValueError('Could not solve the expected-value equations.')
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            if factor:
                augmented[row] = [
                    value - factor * pivot_value
                    for value, pivot_value in zip(augmented[row], augmented[column])
                ]
    return [augmented[row][-1] for row in range(size)]


def estimate_starforce(
    item_level: int,
    start_star: int,
    target_star: int,
    mode_15_17: int = 1,
    mode_18_21: int = 1,
    boom_reset_star: int | None = None,
    mode_by_star: Mapping[int, int] | None = None,
    safeguard_15_17: bool = False,
    safeguard_by_star: Mapping[int, bool] | None = None,
    percentiles: Sequence[float] = (),
    replacement_cost_mesos: float = 0,
    shining_starforce_sunday: bool = False,
    mvp_rank: str = 'none',
    superior_item: bool = False,
    include_budget_distribution: bool = False,
) -> StarForceEstimate:
    """Estimate expected spend, attempts, and booms until reaching a target.

    A boom recovers the star level based on the star where it occurred. Set
    ``boom_reset_star`` to override that recovery level for every boom.
    Expected cost includes replacement_cost_mesos for each expected boom.
    When ``shining_starforce_sunday`` is enabled, the starforce cost is
    discounted by 30% at every star, excluding the added safeguard surcharge
    for 15★–17★ attempts, and the 15★–21★ boom rate is cut by 30%.
    ``mvp_rank`` provides an additional cost discount through 16★, unless
    ``superior_item`` is true. For safeguarded attempts, event and MVP
    discounts combine multiplicatively on the base-cost portion, not the
    safeguard surcharge. Elsewhere, eligible discounts apply to the full cost.
    Individual mode choices override the corresponding band mode.
    Safeguarding 15★–17★ costs 3x the base cost, disables booms, and uses
    Mode 1 rates, as GMS resets Modes 2–3 when safeguarding is enabled.
    ``safeguard_by_star`` overrides the band-wide safeguard setting per star.
    """
    if (isinstance(replacement_cost_mesos, bool)
            or not isinstance(replacement_cost_mesos, (int, float))
            or not isfinite(replacement_cost_mesos) or replacement_cost_mesos < 0):
        raise ValueError('Replacement cost must be a finite nonnegative number.')
    if any(isinstance(p, bool) or not isfinite(p) or not 0 < p < 1 for p in percentiles):
        raise ValueError('Success chances must be between 0 and 1.')
    if type(item_level) is not int or item_level <= 0:
        raise ValueError('Item level must be a positive integer.')
    if type(start_star) is not int or not 0 <= start_star <= 29:
        raise ValueError('Starting Star Force must be between 0 and 29.')
    if type(target_star) is not int or not 1 <= target_star <= 30:
        raise ValueError('Target Star Force must be between 1 and 30.')
    if target_star <= start_star:
        raise ValueError('Target Star Force must be greater than starting Star Force.')
    if (boom_reset_star is not None and
            (type(boom_reset_star) is not int or not 0 <= boom_reset_star <= 29)):
        raise ValueError('Boom reset star must be between 0 and 29.')
    if type(mode_15_17) is not int or mode_15_17 not in (1, 2, 3):
        raise ValueError('Mode for 15–17 star attempts must be 1, 2, or 3.')
    if type(mode_18_21) is not int or mode_18_21 not in (1, 2, 3, 4):
        raise ValueError('Mode for 18–21 star attempts must be 1, 2, 3, or 4.')
    if type(safeguard_15_17) is not bool:
        raise ValueError('safeguard_15_17 must be a boolean.')
    if type(shining_starforce_sunday) is not bool:
        raise ValueError('shining_starforce_sunday must be a boolean.')
    if safeguard_by_star is None:
        safeguard_by_star = {}
    if not isinstance(safeguard_by_star, Mapping):
        raise ValueError('safeguard_by_star must be a mapping of star numbers to booleans.')
    for star, safeguard in safeguard_by_star.items():
        if type(star) is not int or star not in (15, 16, 17):
            raise ValueError('Per-star safeguards can only be set for attempts from 15 to 17 stars.')
        if type(safeguard) is not bool:
            raise ValueError(f'Invalid safeguard value {safeguard!r} for attempt from {star} stars.')
    if mode_by_star is None:
        mode_by_star = {}
    if not isinstance(mode_by_star, Mapping):
        raise ValueError('mode_by_star must be a mapping of star numbers to modes.')
    for star, mode in mode_by_star.items():
        if type(star) is not int or star not in range(15, 22):
            raise ValueError('Per-star modes can only be set for transitions from 15 to 21 stars.')
        allowed_modes = (1, 2, 3) if star <= 17 else (1, 2, 3, 4)
        if type(mode) is not int or mode not in allowed_modes:
            raise ValueError(f'Invalid enhancement mode {mode!r} for transition from {star} stars.')

    modes = [
        mode_by_star.get(
            star,
            mode_15_17 if 15 <= star <= 17 else
            mode_18_21 if 18 <= star <= 21 else 1,
        )
        for star in range(target_star)
    ]
    state_count = target_star
    matrix = [[float(row == column) for column in range(state_count)]
              for row in range(state_count)]
    attempt_costs = []
    transitions = [[0.0] * state_count for _ in range(state_count)]
    boom_probabilities = []
    cost_edges = []

    for star, mode in enumerate(modes):
        safeguard = safeguard_by_star.get(star, safeguard_15_17 and 15 <= star <= 17)
        rates = attempt_rates(
            star,
            mode,
            safeguard=safeguard,
            shining_starforce_sunday=shining_starforce_sunday,
        )
        multiplier = enhancement_mode_multiplier(
            star,
            mode,
            safeguard=safeguard,
            shining_starforce_sunday=shining_starforce_sunday,
            mvp_rank=mvp_rank,
            superior_item=superior_item,
        )
        attempt_costs.append(starforce_base_cost(item_level, star) * multiplier)
        boom_probabilities.append(rates.boom)
        destinations = (
            (star + 1, rates.success),
            (star, rates.maintain),
            (star - 1, rates.downgrade),
            (boom_reset_star if boom_reset_star is not None else
             boom_recovery_star(star), rates.boom),
        )
        cost_edges.append([
            (destination, probability, attempt_costs[-1] + (replacement_cost_mesos if index == 3 else 0))
            for index, (destination, probability) in enumerate(destinations) if probability
        ])
        for destination, probability in destinations:
            if probability and destination < target_star:
                matrix[star][destination] -= probability
                transitions[star][destination] += probability

    expected_cost = _solve_linear_system(matrix, attempt_costs)[start_star]
    expected_attempts = _solve_linear_system(matrix, [1.0] * state_count)[start_star]
    expected_booms = _solve_linear_system(matrix, boom_probabilities)[start_star]
    replacement_cost = expected_booms * replacement_cost_mesos
    distribution = {} if include_budget_distribution else None
    budgets = _meso_percentiles(cost_edges, start_star, percentiles or ([.99] if include_budget_distribution else ()),
                               expected_cost + replacement_cost, distribution)
    return StarForceEstimate(expected_cost + replacement_cost, expected_attempts, expected_booms,
                             _attempt_percentiles(transitions, start_star, percentiles),
                             replacement_cost,
                             budgets if percentiles else (), distribution)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--level', type=int, required=True, help='Equipment required level')
    parser.add_argument('--start', type=int, default=0, help='Starting star (default: 0)')
    parser.add_argument('--target', type=int, required=True, help='Target star')
    parser.add_argument('--replacement-cost-mesos', type=float, default=0,
                        help='Replacement mesos per boom (default: 0)')
    parser.add_argument('--mode-15-17', type=int, choices=(1, 2, 3), default=1,
                        help='Mode used from 15 through 17 stars (default: 1)')
    parser.add_argument('--mode-18-21', type=int, choices=(1, 2, 3, 4), default=1,
                        help='Mode used from 18 through 21 stars (default: 1)')
    for star in range(15, 22):
        choices = (1, 2, 3) if star <= 17 else (1, 2, 3, 4)
        parser.add_argument(
            f'--mode-{star}',
            type=int,
            choices=choices,
            default=None,
            help=f'Override mode for the attempt from {star} to {star + 1} stars',
        )
    parser.add_argument('--safeguard-15-17', action='store_true',
                        help='Safeguard attempts from 15 to 17 stars (3x cost, no booms)')
    parser.add_argument('--boom-reset-star', type=int, default=None,
                        help='Override the recovered star level for every boom')
    args = parser.parse_args(argv)

    try:
        estimate = estimate_starforce(
            item_level=args.level,
            start_star=args.start,
            target_star=args.target,
            mode_15_17=args.mode_15_17,
            mode_18_21=args.mode_18_21,
            boom_reset_star=args.boom_reset_star,
            mode_by_star={
                star: mode for star in range(15, 22)
                if (mode := getattr(args, f'mode_{star}')) is not None
            },
            safeguard_15_17=args.safeguard_15_17,
            replacement_cost_mesos=args.replacement_cost_mesos,
        )
    except ValueError as error:
        parser.error(str(error))

    print(f'Expected mesos:    {estimate.expected_cost:,.0f}')
    print(f'Expected attempts: {estimate.expected_attempts:,.2f}')
    print(f'Expected booms:    {estimate.expected_booms:,.3f}')


if __name__ == '__main__':
    main()
