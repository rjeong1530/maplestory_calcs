"""Tests for the MapleStory.io equipment catalog importer."""
import unittest
from unittest.mock import patch

import fetch_equipment_data as importer


class EquipmentDataTests(unittest.TestCase):
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
