"""Check that the grouped accessory category matches Nexon's other accessories."""
from concurrent.futures import ThreadPoolExecutor
from fetch_potential_data import PARTS, LEVELS, fetch
import json
from pathlib import Path

if __name__ == '__main__':
    PARTS.update({'eye accessory': 16, 'earring': 17, 'ring': 18, 'pendant': 19})
    data = json.loads(Path('potential_data.json').read_text(encoding='utf-8'))['tables']
    jobs = [(c, e, l) for c in ('red', 'black')
            for e in ('eye accessory', 'earring', 'ring', 'pendant') for l in LEVELS]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for key, table in pool.map(fetch, jobs):
            cube, equipment, level = key.split('|')
            if table is not None:
                assert table == data[f'{cube}|accessory|{level}'], key
    print('All available accessory tables match the face-accessory category (48 queries).')
