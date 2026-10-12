"""Local CPU benchmark; synthetic score tables, not Render/API latency.

Run from the repository root: python -m backend.benchmark_laddering
"""
import json
from timeit import repeat

from backend.calc.laddering import ladder_candidate
from backend.calc.overall_upgrade import RollScores


def main():
    state = dict(name='Benchmark hat', slot='hat', current_star=24, spare_star=12, cap=25,
        sf_scores=[i * 10 for i in range(31)],
        current_scores={'flames': 200, 'potential': 300}, spare_scores={'flames': 0, 'potential': 0},
        steps=[dict(action_cost_mesos=1e8, expected_attempts=1, expected_booms=.1,
                    expected_replacement_cost=0) for _ in range(30)])
    rolls = {
        'flames': dict(scores=RollScores({i / 10: 1 / 5000 for i in range(5000)}), cost=3e6),
        'potential': dict(scores=RollScores({i: 1 / 500 for i in range(500)}), cost=22e6),
    }
    row = ladder_candidate(state, rolls)
    timings = repeat(lambda: ladder_candidate(state, rolls), number=10, repeat=3)
    print(json.dumps({'best_ms_per_candidate': min(timings) * 100,
        'result': {key: row[key] for key in ('next_star', 'minimum_flame_score',
                  'minimum_potential_score', 'action_cost_mesos')}}, indent=2))


if __name__ == '__main__':
    main()
