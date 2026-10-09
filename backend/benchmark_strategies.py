"""Compare uncached strategy reports against a committed version."""
import argparse
import gc
import hashlib
import json
import math
from pathlib import Path
import platform
import statistics
import subprocess
import time
import types

from backend.examples import starforce_strategies as current


SOURCE = 'backend/examples/starforce_strategies.py'
ROOT = Path(__file__).resolve().parents[1]


def assert_equivalent(before, after):
    if isinstance(before, dict):
        assert before.keys() == after.keys()
        for key in before:
            assert_equivalent(before[key], after[key])
    elif isinstance(before, list):
        assert len(before) == len(after)
        for old, new in zip(before, after):
            assert_equivalent(old, new)
    elif isinstance(before, float):
        assert math.isclose(before, after, rel_tol=1e-8, abs_tol=1e-6), (before, after)
    else:
        assert before == after, (before, after)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', default='HEAD')
    parser.add_argument('--repeats', type=int, default=5)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error('--repeats must be positive')
    commit = subprocess.check_output(['git', 'rev-parse', args.baseline], cwd=ROOT, text=True).strip()
    source = subprocess.check_output(['git', 'show', f'{commit}:{SOURCE}'], cwd=ROOT)
    baseline = types.ModuleType('_strategy_baseline')
    exec(compile(source, SOURCE, 'exec'), baseline.__dict__)
    report = dict(baseline_commit=commit, platform=platform.platform(),
                  python=platform.python_version(), repeats=args.repeats,
                  current_source_sha256=hashlib.sha256((ROOT / SOURCE).read_bytes()).hexdigest(),
                  comparison_relative_tolerance=1e-8, cases=[])
    for settings in ((200, 15, 22, 1e9), (200, 0, 25, 1e9),
                     (250, 22, 25, 0), (250, 29, 30, 1e15), (150, 0, 10, 0)):
        expected = baseline.analyze_strategies(*settings)
        assert_equivalent(expected, current.analyze_strategies(*settings))
        samples = [[], []]
        for repeat in range(args.repeats):
            for index in ([0, 1] if repeat % 2 == 0 else [1, 0]):
                gc.collect()
                start = time.perf_counter()
                result = (baseline, current)[index].analyze_strategies(*settings)
                samples[index].append(time.perf_counter() - start)
                assert_equivalent(expected, result)
        before, after = map(statistics.median, samples)
        report['cases'].append(dict(settings=settings, before_seconds=samples[0],
            after_seconds=samples[1], before_median_seconds=before, after_median_seconds=after,
            speedup=before / after, frontier_rows=len(expected['efficient_frontier']),
            policies_and_order_identical=True, estimates_within_tolerance=True))
        print(f'{settings}: {before:.4f}s -> {after:.4f}s ({before / after:.1f}x)', flush=True)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
