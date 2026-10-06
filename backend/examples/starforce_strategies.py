"""Compare Star Force policies using the bundled calculator, with SSF and no MVP.

Run: python -m backend.examples.starforce_strategies --level 200 --start 15 --target 22
Mesos are enhancement spending; each boom consumes one additional spare.
"""
from __future__ import annotations

import argparse
import csv
from itertools import product
import json
from pathlib import Path
from typing import Sequence

from backend.calc.starforce_calculator import (
    attempt_rates, boom_recovery_star, enhancement_mode_multiplier,
    estimate_starforce, starforce_base_cost,
)


def _policy(choices):
    return {
        'mode_by_star': {star: mode for star, mode in zip(range(15, 22), choices)
                         if star > 17 or mode != 4},
        'safeguard_by_star': {star: choices[star - 15] == 4 for star in range(15, 18)},
    }


def _terms(level, target):
    """Cache calculator rates and prices once for each legal state/action."""
    terms = {}
    for star in range(target):
        for action in range(1, 5) if 15 <= star <= 21 else (1,):
            safeguard = star <= 17 and action == 4
            mode = 1 if safeguard else action
            rates = attempt_rates(star, mode, safeguard, shining_starforce_sunday=True)
            if rates.downgrade:
                raise ValueError('Policy search requires maintain-only non-boom failures.')
            cost = starforce_base_cost(level, star) * enhancement_mode_multiplier(
                star, mode, safeguard, shining_starforce_sunday=True, mvp_rank='none')
            terms[star, action] = (cost / rates.success, 1 / rates.success,
                                   rates.boom / rates.success, boom_recovery_star(star))
    return terms


def _evaluate(choices, start, target, terms):
    # Expected increments to first reach s+1 from s. A boom must redo every
    # increment from the recovery star through s-1 before retrying this step.
    # This is the calculator's Markov expectation recurrence, avoiding three
    # dense linear solves for each of 4**7 policies.
    costs, attempts, booms = [], [], []
    for star in range(target):
        action = choices[star - 15] if 15 <= star <= 21 else 1
        cost, taps, boom_ratio, recovery = terms[star, action]
        costs.append(cost + boom_ratio * sum(costs[recovery:star]))
        attempts.append(taps + boom_ratio * sum(attempts[recovery:star]))
        booms.append(boom_ratio * (1 + sum(booms[recovery:star])))
    return {
        **_policy(choices),
        'enhancement_cost_mesos': sum(costs[start:]),
        'expected_attempts': sum(attempts[start:]),
        'expected_spares': sum(booms[start:]),
    }


def _verified(row, level, start, target, spare_value):
    """Publish estimates from the existing calculator for every selected row."""
    estimate = estimate_starforce(level, start, target,
        mode_by_star=row['mode_by_star'], safeguard_by_star=row['safeguard_by_star'],
        shining_starforce_sunday=True, mvp_rank='none', replacement_cost_mesos=spare_value)
    return {**row,
        'enhancement_cost_mesos': estimate.expected_cost - estimate.expected_replacement_cost,
        'expected_attempts': estimate.expected_attempts,
        'expected_spares': estimate.expected_booms,
        'expected_replacement_cost_mesos': estimate.expected_replacement_cost,
        'total_cost_mesos': estimate.expected_cost,
    }


def analyze_strategies(level=200, start=15, target=22, spare_value=1_000_000_000):
    """Return presets, exact policy-search winners, and the cost/spare frontier.

    The search covers stationary per-star policies, including recovery below
    the starting star. It does not model stopping after a fixed spare budget.
    Spare value can represent replacement price or a user's scarcity penalty.
    """
    # Delegate input validation to the calculator before building search states.
    estimate_starforce(level, start, target, replacement_cost_mesos=spare_value,
                       shining_starforce_sunday=True, mvp_rank='none')
    terms = _terms(level, target)
    active = range(15, min(target, 22))
    candidates = []
    for actions in product(range(1, 5), repeat=len(active)):
        choices = actions + (1,) * (7 - len(actions))
        candidates.append(_evaluate(choices, start, target, terms))
    frontier = []
    best_spares = float('inf')
    for row in sorted(candidates, key=lambda r: (r['enhancement_cost_mesos'], r['expected_spares'])):
        if row['expected_spares'] < best_spares:
            frontier.append(row)
            best_spares = row['expected_spares']
    min_cost = frontier[0]['enhancement_cost_mesos']
    max_cost = frontier[-1]['enhancement_cost_mesos']
    min_spares = frontier[-1]['expected_spares']
    max_spares = frontier[0]['expected_spares']

    def balanced_key(row):
        cost_range = max_cost - min_cost
        spare_range = max_spares - min_spares
        normalized_cost = ((row['enhancement_cost_mesos'] - min_cost) / cost_range
                           if cost_range else 0)
        normalized_spares = ((row['expected_spares'] - min_spares) / spare_range
                             if spare_range else 0)
        return (
            normalized_cost + normalized_spares,
            row['enhancement_cost_mesos'] + spare_value * row['expected_spares'],
            row['enhancement_cost_mesos'],
        )

    objectives = [
        ('Lowest enhancement spending',
         lambda r: (r['enhancement_cost_mesos'], r['expected_spares'])),
        ('Fewest expected spares',
         lambda r: (r['expected_spares'], r['enhancement_cost_mesos'])),
        ('Lowest total cost at your spare value',
         lambda r: (r['enhancement_cost_mesos'] + spare_value * r['expected_spares'],
                    r['expected_spares'])),
        ('Best balanced tradeoff',
         balanced_key),
    ]
    def publish(row, name):
        efficient = not any(
            other['enhancement_cost_mesos'] <= row['enhancement_cost_mesos']
            and other['expected_spares'] <= row['expected_spares']
            and (other['enhancement_cost_mesos'] < row['enhancement_cost_mesos']
                 or other['expected_spares'] < row['expected_spares']) for other in frontier)
        return _verified({**row, 'name': name, 'on_efficient_frontier': efficient},
                         level, start, target, spare_value)
    published_winners = [
        publish(min(candidates, key=key), name) for name, key in objectives
    ]
    scenarios_by_policy = {}
    for row in published_winners:
        policy = (
            tuple(sorted(row['mode_by_star'].items())),
            tuple(sorted(row['safeguard_by_star'].items())),
        )
        if policy in scenarios_by_policy:
            scenarios_by_policy[policy]['name'] += f' + {row["name"]}'
        else:
            scenarios_by_policy[policy] = dict(row)
    scenarios = list(scenarios_by_policy.values())
    return {
        'assumptions': {
            'item_level': level, 'start_star': start, 'target_star': target,
            'shining_starforce_sunday': True, 'mvp_rank': 'none',
            'spare_value_mesos': spare_value, 'policies_evaluated': len(candidates),
            'scope': 'Standard equipment; stationary per-star policies; unlimited retries and replacement availability.',
            'notes': [
                'Expected spares equal expected booms and exclude the original item; fractional averages are not guarantees.',
                'Policy keys are starting stars: 17 means the attempt from 17 to 18, including recovery attempts.',
                'Safeguard uses Mode 1 at 15-17; Mode 4 is available only at 18-21.',
                'Outside 15-21 all presets use standard rates. Above target 22, no preset guarantees zero booms.',
                'Policies may tie or become identical for shorter ranges. Item-specific star caps are not inferred from level.',
                'Total cost adds the assigned spare value per expected boom; it is not a budget percentile.',
                'Presets optimize enhancement spending, total cost at the assigned spare value, expected spares, or a balanced tradeoff.',
                'The balanced preset minimizes the equal-weight sum of normalized enhancement spending and expected spares, scaled between the frontier extremes.',
                'Presets with the same policy are combined in scenarios; recommendations retains one row per priority.',
                'Every preset is on the cost/spare frontier.',
            ],
        },
        'scenarios': scenarios,
        'baseline': publish(_evaluate((1,) * 7, start, target, terms), 'Full Mode 1 (baseline)'),
        'recommendations': published_winners,
        'efficient_frontier': [publish(row, f'Tradeoff {index}') for index, row in enumerate(frontier, 1)],
    }


def _policy_text(row):
    return ', '.join(f'{star}:SG' if row['safeguard_by_star'].get(star) else
                     f'{star}:M{row["mode_by_star"].get(star, 1)}' for star in range(15, 22))


def main(argv: Sequence[str] | None = None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--level', type=int, default=200)
    parser.add_argument('--start', type=int, default=15)
    parser.add_argument('--target', type=int, default=22)
    parser.add_argument('--spare-value', type=float, default=1_000_000_000,
                        help='Meso price or scarcity value assigned to each spare (default: 1B).')
    parser.add_argument('--json', type=Path, help='Write the full report for an app or further analysis.')
    parser.add_argument('--csv', type=Path, help='Write scenarios, recommendations and frontier for a spreadsheet.')
    args = parser.parse_args(argv)
    try:
        report = analyze_strategies(args.level, args.start, args.target, args.spare_value)
    except ValueError as error:
        parser.error(str(error))
    print(f'Level {args.level}, {args.start} -> {args.target} stars | Shining Star Force | MVP: none')
    print(f'Spare value: {args.spare_value:,.0f} mesos | Policies searched: {report["assumptions"]["policies_evaluated"]:,}')
    print(f'{"Strategy":53} {"Tap mesos (B)":>13} {"Spares":>9} {"Total (B)":>11} {"Attempts":>11}')
    for row in report['scenarios']:
        print(f'{row["name"]:53} {row["enhancement_cost_mesos"] / 1e9:13.3f} '
              f'{row["expected_spares"]:9.3f} {row["total_cost_mesos"] / 1e9:11.3f} '
              f'{row["expected_attempts"]:11.1f}')
        print('  ' + _policy_text(row))
    print(f'Cost/spare frontier: {len(report["efficient_frontier"])} strategies (included in JSON/CSV).')
    for note in report['assumptions']['notes']:
        print(note)
    if args.json:
        args.json.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    if args.csv:
        rows = [{ 'section': section, **{key: value for key, value in row.items()
                  if key not in ('mode_by_star', 'safeguard_by_star')}, 'policy': _policy_text(row)}
                for section in ('scenarios', 'recommendations', 'efficient_frontier') for row in report[section]]
        with args.csv.open('w', newline='', encoding='utf-8') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


if __name__ == '__main__':
    main()
