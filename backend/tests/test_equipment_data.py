"""Tests for the MapleStory.io equipment catalog importer."""
import unittest
from unittest.mock import patch

from backend.scripts import fetch_equipment_data as importer


class EquipmentDataTests(unittest.TestCase):
    def test_ordinary_shield_filter_preserves_job_specific_shields(self):
        for item_id, name, expected in (
            (1092087, 'Deimos Warrior Shield', True),
            (1092113, 'Terminus Defender', True),
            (1092123, 'Astra Sacred Aegis', True),
            (1092058, 'Timeless Kite Shield', False),
            (1092049, 'Dragon Khanjar', False),
            (1098003, 'Soul Shield of Justice', True),
            (1099015, 'Ruin Force Shield', True),
        ):
            with self.subTest(name=name):
                self.assertEqual(importer.keep_equipment({
                    'itemid': item_id, 'name': name, 'slot': 'secondary',
                    'level': 140, 'equipment_type': 'Shield',
                }), expected)

    def test_only_requested_katara_series_are_retained(self):
        for name in ('Fafnir Rapid Edge', 'AbsoLab Katara', 'Sweetwater Katara',
                     'Arcane Umbra Katara', 'Astra Katara', 'Frozen Katara',
                     'Meteor Katara', 'Princess No\'s Poisoned Sword'):
            with self.subTest(name=name):
                item = {'itemid': 1342000, 'slot': 'secondary', 'level': 200,
                        'name': name, 'equipment_type': 'Katara'}
                self.assertEqual(importer.keep_equipment(item),
                                 name.startswith(('Fafnir ', 'AbsoLab ', 'Sweetwater ', 'Arcane Umbra ', 'Astra ')))

    def test_secondary_scope_includes_level_100_and_uncategorized_astra(self):
        for item_id, name, level, category in (
            (1353004, 'Octa Core Controller', 100, 'Secondary Weapon'),
            (1723000, 'Astra Deca Core Controller', 200, 'Unknown'),
            (1342121, 'Astra Katara', 200, 'One-Handed Weapon'),
        ):
            with self.subTest(item=name):
                raw = {'id': item_id, 'name': name, 'requiredLevel': level,
                       'requiredJobs': ['Thief'], 'typeInfo': {
                           'overallCategory': 'Unknown' if category == 'Unknown' else 'Equip',
                           'category': category, 'subCategory': 'Unknown',
                       }}
                item = importer.normalize(raw)
                self.assertEqual(item['slot'], 'secondary')
                self.assertEqual(item['level'], level)
                self.assertTrue(importer.keep_equipment(item))
        self.assertFalse(importer.in_catalog_scope({
            'id': 1000000, 'name': 'Low level hat', 'requiredLevel': 100,
            'typeInfo': {'overallCategory': 'Equip'},
        }))
        self.assertFalse(importer.in_catalog_scope({
            'id': 2831483, 'name': 'Astra Secondary Weapon Box',
            'typeInfo': {'overallCategory': 'Unknown'},
        }))

    def test_secondary_deduplication_preserves_existing_astra_id(self):
        rows = [{'itemid': item_id, 'name': 'Astra Deca Core Controller',
                 'slot': 'secondary', 'level': 200, 'equipment_type': 'Secondary Weapon'}
                for item_id in (1723002, 1723000, 1723001)]
        self.assertEqual([row['itemid'] for row in importer.catalog_items(rows)], [1723000])

    def test_normalize_defaults_missing_boss_reward_to_false(self):
        item = {
            'id': 1004422,
            'name': 'AbsoLab Knight Helm',
            'requiredLevel': 160,
            'requiredJobs': ['Warrior'],
            'typeInfo': {
                'overallCategory': 'Equip',
                'category': 'Equip',
                'subCategory': 'Hat',
            },
        }

        self.assertFalse(importer.normalize(item)['boss_reward'])

    def test_fetch_boss_reward_reads_item_detail_and_defaults_missing_tag(self):
        with patch.object(importer, 'fetch_json', return_value={
            'metaInfo': {'bossReward': True},
        }) as fetch:
            self.assertTrue(importer.fetch_boss_reward(1004422, '270'))
            fetch.assert_called_once_with(
                'https://maplestory.io/api/GMS/270/item/1004422'
            )

        with patch.object(importer, 'fetch_json', return_value={'metaInfo': {}}):
            self.assertFalse(importer.fetch_boss_reward(1003719, '270'))

        with patch.object(importer, 'fetch_json', return_value=None):
            self.assertFalse(importer.fetch_boss_reward(1082760, '270'))


if __name__ == '__main__':
    unittest.main()
