"""Projected upgrade order using comparable weighted score gain per meso."""
from bisect import bisect_left, bisect_right
from math import fsum
from copy import deepcopy
from backend.calc.laddering import ladder_candidate


class RollScores:
    """Tail probabilities and score sums for a fixed independent-roll table."""

    def __init__(self, distribution):
        outcomes = sorted((score, chance) for score, chance in distribution.items() if chance > 0)
        self.scores = [score for score, _ in outcomes]
        self.chances = [0.0] * (len(outcomes) + 1)
        self.totals = [0.0] * (len(outcomes) + 1)
        for index in range(len(outcomes) - 1, -1, -1):
            score, chance = outcomes[index]
            self.chances[index] = self.chances[index + 1] + chance
            self.totals[index] = self.totals[index + 1] + score * chance

    def efficiency(self, current, cost):
        index = bisect_right(self.scores, current + 1e-9)
        return max(0.0, self.totals[index] - current * self.chances[index]) / cost

    def target(self, current, cost, competing_efficiency=0):
        """Stop when another action is at least as efficient as another flame.

        Without a competing action, recommend the next improvement rather than
        chasing the theoretical maximum score. Targets are attainable roll scores.
        """
        first = bisect_right(self.scores, current + 1e-9)
        if first == len(self.scores):
            return None
        low, high = first, len(self.scores) - 1
        if competing_efficiency > 0:
            while low < high:
                middle = (low + high) // 2
                if self.efficiency(self.scores[middle], cost) <= competing_efficiency:
                    high = middle
                else:
                    low = middle + 1
        return self.scores[low]

    def estimate(self, current, target, cost):
        index = bisect_left(self.scores, target)
        chance = self.chances[index]
        expected_score = self.totals[index] / chance
        gain = expected_score - current
        spending = cost / chance
        return {
            'target_score': target, 'expected_final_score': expected_score,
            'expected_score_gain': gain, 'action_cost_mesos': spending,
            'gain_per_meso': gain / spending, 'expected_attempts': 1 / chance,
            'improvement_probability': chance,
        }


def _starforce_candidate(queue):
    """Compare ranges of up to six stars, including the bridge through 15."""
    start = queue[0]['start_star']
    horizon = 21 - start if start < 15 else 6
    best = None
    for length in range(1, min(horizon, len(queue)) + 1):
        step = queue[length - 1]
        if step['start_star'] != start + length - 1 or step['next_star'] != start + length:
            break
        if length > 6 and step['next_star'] <= 15:
            continue
        steps = queue[:length]
        cost = fsum(row['action_cost_mesos'] for row in steps)
        gain = fsum(row['expected_score_gain'] for row in steps)
        efficiency = gain / cost if cost > 0 else 0
        if efficiency > 0 and (best is None or efficiency > best['gain_per_meso']):
            best = {
                **queue[0], 'category': 'starforce', 'next_star': step['next_star'],
                'expected_score_gain': gain, 'action_cost_mesos': cost,
                'gain_per_meso': efficiency,
                'expected_attempts': fsum(row.get('expected_attempts', 0) for row in steps),
                'expected_booms': fsum(row.get('expected_booms', 0) for row in steps),
                'expected_final_score': queue[0]['current_score'] + gain,
                '_length': length,
            }
    return best


def overall_upgrade_order(starforce_entries, roll_states, limit=20, laddering_states=None, laddering_notes=None):
    """Re-evaluate after each projected action; actual rolls require recalculation.

    The next action maximizes current gain/meso (with Star Force lookahead).
    A flame action continues to the switching threshold against the best other
    action. Subsequent states use conditional mean outcomes, not guaranteed rolls.
    This is a greedy projection, not a globally optimal stochastic budget policy.
    """
    queues = {}
    for entry in starforce_entries:
        if entry['expected_score_gain'] is not None and entry['action_cost_mesos'] > 0:
            queues.setdefault(entry['slot'], []).append(dict(entry))
    for slot, queue in list(queues.items()):
        queue.sort(key=lambda row: row['start_star'])
        if queue[0]['start_star'] != queue[0]['current_star_force']:
            del queues[slot]
    states = [{**state, 'entry': dict(state['entry']), 'scores': RollScores(state['distribution'])}
              for state in roll_states]
    ladders = deepcopy(laddering_states or {})
    for ladder in ladders.values():
        ladder.setdefault('active', ladder['current_star'] >= ladder['start_star'])
        ladder['current_copy_label'] = 'Original'
        ladder['spare_copy_label'] = 'Spare'
    rows = []
    cumulative_cost = 0.0
    for _ in range(limit):
        candidates = []
        for slot, queue in queues.items():
            ladder = ladders.get(slot)
            if ladder and ladder['active']:
                continue
            eligible = [row for row in queue if not ladder or row['next_star'] <= ladder['start_star']]
            candidate = _starforce_candidate(eligible) if eligible else None
            if candidate:
                candidates.append((candidate['gain_per_meso'], 'starforce', slot, candidate))
        for slot, ladder in ladders.items():
            rolls = {state['category']: state for state in states if state['entry']['slot'] == slot}
            for category, state in rolls.items():
                ladder['current_scores'][category] = state['entry']['current_score']
            if not ladder['active']:
                continue
            try:
                candidate = ladder_candidate(ladder, rolls)
            except ValueError as error:
                if laddering_notes is not None and not ladder.get('blocked'):
                    laddering_notes.append({'slot': slot, 'name': ladder['name'], 'category': 'starforce', 'note': str(error)})
                ladder['blocked'] = True
                candidate = None
            if candidate:
                candidates.append((candidate['gain_per_meso'], 'starforce', slot, candidate))
        for index, state in enumerate(states):
            efficiency = state['scores'].efficiency(state['entry']['current_score'], state['cost'])
            if efficiency > 0:
                candidates.append((efficiency, state['category'], index, state))
        if not candidates:
            break
        candidates.sort(key=lambda candidate: (
            0 if candidate[1] == 'starforce' and candidate[3]['action_cost_mesos'] == 0 else 1,
            -candidate[0]))
        efficiency, category, key, candidate = candidates[0]
        competitor = candidates[1][0] if len(candidates) > 1 else 0
        if category == 'starforce':
            row = dict(candidate)
            if row.get('laddering'):
                ladder = ladders[key]
                row['copy_label'] = ladder['spare_copy_label']
                row['protected_copy_label'] = ladder['current_copy_label']
                ladder['current_copy_label'], ladder['spare_copy_label'] = (
                    ladder['spare_copy_label'], ladder['current_copy_label'])
                ladder['spare_star'] = ladder['current_star']
                ladder['spare_scores'] = dict(ladder['current_scores'])
                ladder['current_star'] = row['next_star']
                ladder['assumed_copy'] = False
                ladder['current_scores'] = {'flames': row['expected_flame_score'], 'potential': row['expected_potential_score']}
                for state in states:
                    if state['entry']['slot'] == key:
                        state['entry']['current_score'] = ladder['current_scores'][state['category']]
                queues.pop(key, None)
            else:
                del queues[key][:row.pop('_length')]
                if key in ladders:
                    ladders[key]['current_star'] = row['next_star']
                    ladders[key]['active'] = row['next_star'] >= ladders[key]['start_star']
                if not queues[key]:
                    del queues[key]
        else:
            state = candidate
            current = state['entry']['current_score']
            target = state['scores'].target(current, state['cost'], competitor if category == 'flames' else 0)
            if target is None:
                break
            row = {
                **state['entry'], 'category': category,
                **state['scores'].estimate(current, target, state['cost']),
            }
            state['entry']['current_score'] = row['expected_final_score']
        if row['slot'] in ladders and not row.get('laddering'):
            row['copy_label'] = ladders[row['slot']]['current_copy_label']
        cumulative_cost += row['action_cost_mesos']
        rows.append({
            **row, 'step': len(rows) + 1,
            'starting_gain_per_meso': efficiency,
            'competing_gain_per_meso': competitor,
            'cumulative_cost_mesos': cumulative_cost,
        })
    return rows
