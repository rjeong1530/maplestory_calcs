"""Two-copy Star Force candidates for the greedy overall upgrade projection."""
from bisect import bisect_left, bisect_right
from math import fsum


def prepare_score(current, minimum, roll):
    """Keep an existing sufficient score, or roll to an attainable minimum."""
    if current >= minimum:
        return {'score': current, 'minimum': minimum, 'cost': 0.0, 'attempts': 0.0}
    if roll is None:
        raise ValueError('Enable the required roll category to price the second copy’s minimum scores.')
    scores = roll['scores']
    index = bisect_left(scores.scores, minimum)
    if index == len(scores.scores) or scores.chances[index] <= 0:
        raise ValueError('The second copy’s minimum score is not attainable with the selected roll table.')
    estimate = scores.estimate(current, scores.scores[index], roll['cost'])
    return {'score': estimate['expected_final_score'], 'minimum': minimum,
            'cost': estimate['action_cost_mesos'], 'attempts': estimate['expected_attempts']}


def _preparation_options(current, rolls):
    """Build monotone score/cost arrays once per spare, shared across star targets."""
    options = {}
    for category, value in current.items():
        values, costs = [value], [0.0]
        if category in rolls:
            roll = rolls[category]
            scores = roll['scores']
            first = bisect_right(scores.scores, value)
            values.extend(scores.scores[first:])
            costs.extend(roll['cost'] / chance for chance in scores.chances[first:-1])
        options[category] = (values, costs)
    return options


def automatic_preparation(current, required, rolls, options=None):
    """Cheapest attainable pair of stopping scores whose sum beats required.

    Enumerate the smaller roll table and find the other target by binary search.
    Existing scores are retained when sufficient; disabled categories cannot roll.
    """
    if fsum(current.values()) > required + 1e-9:
        return {category: prepare_score(value, value, None) for category, value in current.items()}
    if options is None:
        options = _preparation_options(current, rolls)
    first, second = sorted(options, key=lambda category: len(options[category][0]))
    first_values, first_costs = options[first]
    second_values, second_costs = options[second]
    best = None
    best_cost = float('inf')
    for value, first_cost in zip(first_values, first_costs):
        index = bisect_right(second_values, required - value + 1e-9)
        if index == len(second_values):
            continue
        cost = first_cost + second_costs[index]
        if cost < best_cost:
            best_cost = cost
            best = (value, second_values[index])
    if best is None:
        return None
    return {first: prepare_score(current[first], best[0], rolls.get(first)),
            second: prepare_score(current[second], best[1], rolls.get(second))}


def ladder_candidate(state, rolls):
    """Bundle spare catch-up and preparation before counting any equipped gain.

    Star Force proceeds first; flames and potential stay on a recovered trace.
    Roll the successful spare afterwards, so preparation is not paid per boom.
    """
    if state.get('blocked'):
        return None
    current = state['current_star']
    spare = state['spare_star']
    best = None
    initial = state['sf_scores'][current] + fsum(state['current_scores'].values())
    preparation_options = _preparation_options(state['spare_scores'], rolls)
    # A better-rolled spare may improve the total even at equal/lower stars.
    # Include that swap and all catch-up targets, then six stars beyond current.
    for target in range(spare, min(state['cap'], max(current + 6, spare)) + 1):
        prepared = automatic_preparation(state['spare_scores'], initial - state['sf_scores'][target], rolls,
                                         preparation_options)
        if prepared is None:
            continue
        steps = state['steps'][spare:target]
        sf_cost = fsum(step['action_cost_mesos'] for step in steps)
        prep_cost = fsum(value['cost'] for value in prepared.values())
        cost = sf_cost + prep_cost
        final = state['sf_scores'][target] + fsum(value['score'] for value in prepared.values())
        gain = final - initial
        # Ensure even a qualifying roll at its minimum improves the equipped
        # score, rather than recommending a swap solely on an average overshoot.
        minimum_final = state['sf_scores'][target] + fsum(
            max(state['spare_scores'][category], prepared[category]['minimum'])
            for category in prepared)
        if gain <= 1e-9 or minimum_final <= initial + 1e-9:
            continue
        efficiency = gain / cost if cost > 0 else 0
        if (best is None or (best['action_cost_mesos'] > 0
                            and (cost == 0 or efficiency > best['gain_per_meso']))):
            best = {
                'name': state['name'], 'slot': state['slot'], 'category': 'starforce',
                'laddering': True, 'protected_star': current, 'start_star': spare, 'next_star': target,
                'assumed_second_copy': state.get('assumed_copy', False),
                'current_star_force': current, 'current_score': initial, 'expected_final_score': final,
                'expected_score_gain': gain, 'minimum_score_gain': minimum_final - initial,
                'break_even_combined_roll_score': initial - state['sf_scores'][target],
                'action_cost_mesos': cost, 'starforce_cost_mesos': sf_cost,
                'preparation_cost_mesos': prep_cost, 'gain_per_meso': efficiency,
                'expected_attempts': fsum(step['expected_attempts'] for step in steps),
                'expected_booms': fsum(step['expected_booms'] for step in steps),
                'expected_replacement_cost': fsum(step['expected_replacement_cost'] for step in steps),
                'minimum_flame_score': prepared['flames']['minimum'],
                'minimum_potential_score': prepared['potential']['minimum'],
                'spare_flame_score': state['spare_scores']['flames'],
                'spare_potential_score': state['spare_scores']['potential'],
                'expected_flame_score': prepared['flames']['score'],
                'expected_potential_score': prepared['potential']['score'],
                'expected_flames': prepared['flames']['attempts'],
                'expected_cubes': prepared['potential']['attempts'],
            }
    return best
