"""Exercise real frontend-imported JSON samples against the API (requires Node)."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from fastapi.testclient import TestClient

from backend.api.main import app
from backend.calc.maplestory_potential import get_potentials_by_line


class SecondaryTableTests(unittest.TestCase):
    def test_secondary_tables_are_equivalent(self):
        for cube in ('red', 'black'):
            for level in (100, 140, 150, 160, 200):
                shared = get_potentials_by_line('secondary weapon', level, cube)
                for kind in ('force shield', 'soul ring', 'shield'):
                    with self.subTest(cube=cube, level=level, kind=kind):
                        self.assertEqual(shared, get_potentials_by_line(kind, level, cube))


@unittest.skipUnless(shutil.which('node'), 'Node is required for the frontend/API integration tests')
class EquipmentSampleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[2]
        output = subprocess.run(
            [shutil.which('node'), 'frontend/scripts/equipment-samples.mjs', '--requests'],
            cwd=root, capture_output=True, text=True, encoding='utf-8', check=True, timeout=30,
        )
        cls.samples = json.loads(output.stdout)

    def test_all_class_samples_have_editable_rolls_and_calculate_upgrades(self):
        with TestClient(app) as client:
            for sample in self.samples:
                request = sample['request']
                with self.subTest(maple_class=sample['maple_class']):
                    for item in request['equipment']:
                        params = {
                            'level': item['equipment_level'],
                            'potential_equipment_type': item['potential_equipment_type'],
                            'boss_equipment': item['boss_equipment'],
                            'offense_stat': request['offense_stat'],
                        }
                        if item['current_flames']:
                            params['flame_equipment_type'] = item['equipment_type']
                        if item['base_weapon_offense']:
                            params['base_weapon_offense'] = item['base_weapon_offense']
                        response = client.get('/api/item-options', params=params)
                        self.assertEqual(response.status_code, 200, response.text)
                        options = response.json()
                        for index, line in enumerate(item['current_potential']):
                            values = options['potential']['values_by_line'][index]['values']
                            self.assertIn(line['value'], values.get(line['effect'], []), item['name'])
                        for line in item['current_flames']:
                            self.assertIn(line['option'], options['flame_options'])
                            self.assertIn(line['stage'], options['flame_stages'])
                    response = client.post('/api/equipment-upgrade-plan', json=request)
                    self.assertEqual(response.status_code, 200, response.text)
                    result = response.json()
                    self.assertEqual(set(result['rankings']), {'potential', 'flames', 'starforce'})
                    slots = {item['slot'] for item in request['equipment']}
                    for category, rankings in result['rankings'].items():
                        rows = rankings['weakest_first'] + rankings['unavailable']
                        self.assertEqual({row['slot'] for row in rows}, slots, category)
                        if category == 'potential':
                            self.assertFalse(rankings['unavailable'], rankings['unavailable'])
                        if category == 'flames':
                            self.assertTrue(rankings['weakest_first'])
                    if sample['maple_class'] == 'Demon Avenger':
                        self.assertFalse(result['rankings']['starforce']['weakest_first'])
                    else:
                        self.assertTrue(result['rankings']['starforce']['weakest_first'])


if __name__ == '__main__':
    unittest.main()
