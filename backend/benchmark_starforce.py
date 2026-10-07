"""Compare committed and working-tree Star Force code without changing either.

Run from the repository root with python -m backend.benchmark_starforce.
Timing excludes module loading and tracemalloc; memory is measured separately.
"""
import argparse
from dataclasses import asdict
import gc
import hashlib
import json
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time
import tracemalloc
import types


ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'backend/calc/starforce_calculator.py'
CASES = [
    ('all reachable: 0-15', dict(item_level=200, start_star=0, target_star=15)),
    ('typical recovery: 15-22', dict(item_level=200, start_star=15, target_star=22)),
    ('no booms: 18-19 Mode 4', dict(item_level=200, start_star=18, target_star=19,
                                  mode_18_21=4, shining_starforce_sunday=True)),
    ('high stars: 22-25', dict(item_level=250, start_star=22, target_star=25,
                              replacement_cost_mesos=1_000_000_000, mvp_rank='gold')),
    ('no percentiles control: 15-22', dict(item_level=200, start_star=15,
                                         target_star=22, percentiles=[])),
]


def load_source(name, source):
    module = types.ModuleType(name)
    sys.modules[name] = module
    exec(compile(source, SOURCE, 'exec'), module.__dict__)
    return module


def comparable(result):
    result = asdict(result)
    result.pop('budget_distribution', None)
    for row in result['meso_estimates']:
        row.pop('rounding_unit_mesos', None)
        row.pop('calculation_limit_mesos', None)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', default='HEAD')
    parser.add_argument('--repeats', type=int, default=5)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error('--repeats must be positive')
    commit = subprocess.check_output(['git', 'rev-parse', args.baseline], cwd=ROOT, text=True).strip()
    old = subprocess.check_output(['git', 'show', f'{commit}:{SOURCE}'], cwd=ROOT)
    new = (ROOT / SOURCE).read_bytes()
    modules = [load_source('_benchmark_before', old), load_source('_benchmark_after', new)]
    report = dict(baseline_commit=commit, current_source_sha256=hashlib.sha256(new).hexdigest(),
                  python=sys.version, platform=platform.platform(), processor=platform.processor(),
                  repeats=args.repeats, percentile_probabilities=[.5, .75, .9, .95, .99], cases=[])
    for name, settings in CASES:
        settings = {'percentiles': report['percentile_probabilities'], **settings}
        # One untimed warmup per version, also checking every existing output field.
        expected = comparable(modules[0].estimate_starforce(**settings))
        if comparable(modules[1].estimate_starforce(**settings)) != expected:
            raise AssertionError(f'Output mismatch: {name}')
        samples = [[], []]
        for repeat in range(args.repeats):
            # Alternate order to reduce systematic bias from temperature/background work.
            for index in ([0, 1] if repeat % 2 == 0 else [1, 0]):
                gc.collect()
                start = time.perf_counter()
                result = modules[index].estimate_starforce(**settings)
                samples[index].append(time.perf_counter() - start)
                if comparable(result) != expected:
                    raise AssertionError(f'Output mismatch: {name}')
        medians = [statistics.median(sample) for sample in samples]
        print(f'{name}: timing {medians[0]:.4f}s -> {medians[1]:.4f}s; measuring memory...', flush=True)
        peaks = []
        for module in modules:
            gc.collect()
            tracemalloc.start()
            try:
                result = module.estimate_starforce(**settings)
                peaks.append(tracemalloc.get_traced_memory()[1])
            finally:
                tracemalloc.stop()
            if comparable(result) != expected:
                raise AssertionError(f'Output mismatch under tracing: {name}')
        row = dict(name=name, settings=settings, before_seconds=samples[0], after_seconds=samples[1],
                   before_median_seconds=medians[0], after_median_seconds=medians[1],
                   speedup=medians[0] / medians[1],
                   before_peak_traced_bytes=peaks[0], after_peak_traced_bytes=peaks[1],
                   existing_outputs_equal=True)
        report['cases'].append(row)
        print(f'  peak traced memory {peaks[0] / 1048576:.3f} -> {peaks[1] / 1048576:.3f} MiB; outputs identical', flush=True)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    else:
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
