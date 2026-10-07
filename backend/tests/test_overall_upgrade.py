import unittest
from unittest.mock import patch

from backend.calc.overall_upgrade import RollScores, overall_upgrade_order
from backend.calc.equipment_upgrade import equipment_upgrade_plan
from backend.api.main import EquipmentUpgradePlanRequest, app
from fastapi.testclient import TestClient

FLAME_WEIGHTS = {'all_stat_pct_value': 10, 'secondary_stat_value': .1,
                 'attack_value': 3, 'boss_damage_pct_value': 10}
POTENTIAL_WEIGHTS = {'base_stat_pct_value': 10, 'attack_pct_value': 10,
                     'crit_damage_pct_value': 8}


def roll(category, distribution, current=0, cost=1, slot='hat'):
    return {
        'category': category, 'cost': cost, 'distribution': distribution,
        'entry': {'slot': slot, 'name': slot, 'current_score': current, 'equipment_level': 200},
    }


def star(start, gain, cost=1, slot='hat', current_star=0):
    return {
        'slot': slot, 'name': slot, 'current_star_force': current_star,
        'start_star': start, 'next_star': start + 1, 'current_score': start,
        'expected_score_gain': gain, 'action_cost_mesos': cost,
    }


class OverallUpgradeTests(unittest.TestCase):
    def test_flame_target_switches_at_competing_efficiency_and_accounts_for_overshoot(self):
        scores = RollScores({0: .5, 10: .25, 20: .25})
        self.assertEqual(scores.target(0, 1, 3), 10)
        self.assertEqual(scores.target(0, 1, 2), 20)
        estimate = scores.estimate(0, 10, 1)
        self.assertEqual(estimate['expected_attempts'], 2)
        self.assertEqual(estimate['expected_final_score'], 15)
        self.assertEqual(estimate['gain_per_meso'], 7.5)
        self.assertEqual(scores.efficiency(10, 1), 2.5)

    def test_threshold_uses_obtainable_scores_and_reacts_to_current_score_and_cost(self):
        scores = RollScores({0: .5, 12.5: .25, 31.75: .25})
        self.assertEqual(scores.target(0, 1, 5), 12.5)
        self.assertEqual(scores.target(12.5, 1, 5), 31.75)
        self.assertEqual(scores.target(0, 1, 3), 31.75)
        self.assertEqual(scores.target(0, 2, 3), 12.5)
        self.assertIsNone(scores.target(31.75, 1, 3))
        self.assertEqual(scores.target(0, 1), 12.5)

    def test_combined_order_switches_categories_and_reprojects_actual_gain(self):
        states = [roll('flames', {0: .5, 10: .25, 20: .25}),
                  roll('potential', {0: .5, 6: .5}, slot='gloves')]
        rows = overall_upgrade_order([star(0, 2)], states, limit=3)
        self.assertEqual([row['category'] for row in rows], ['flames', 'potential', 'starforce'])
        self.assertEqual(rows[0]['target_score'], 10)
        self.assertEqual(rows[0]['expected_final_score'], 15)
        self.assertEqual(rows[-1]['cumulative_cost_mesos'], 5)
        self.assertEqual(states[0]['entry']['current_score'], 0)

    def test_starforce_lookahead_includes_bridge_cost_and_respects_prerequisites(self):
        steps = [star(14, 1, 100, current_star=14), star(15, 100, 1, current_star=14)]
        rolls = [roll('potential', {1: 1}, cost=2)]
        rows = overall_upgrade_order(steps, rolls, limit=1)
        self.assertEqual(rows[0]['category'], 'starforce')
        self.assertEqual((rows[0]['start_star'], rows[0]['next_star']), (14, 16))
        self.assertEqual(rows[0]['action_cost_mesos'], 101)
        self.assertEqual(rows[0]['gain_per_meso'], 1)
        steps[0]['action_cost_mesos'] = 1000
        self.assertEqual(overall_upgrade_order(steps, rolls, limit=1)[0]['category'], 'potential')
        self.assertEqual(overall_upgrade_order([star(16, 100, current_star=14)], []), [])

    def test_empty_maxed_and_zero_gain_states_do_not_produce_recommendations(self):
        self.assertEqual(overall_upgrade_order([], []), [])
        self.assertEqual(overall_upgrade_order([], [roll('flames', {0: 1})]), [])
        self.assertEqual(overall_upgrade_order([], [roll('potential', {10: 1}, current=10)]), [])
        self.assertEqual(overall_upgrade_order([star(0, 0)], []), [])
        self.assertEqual(overall_upgrade_order([], [roll('flames', {})]), [])

    def test_projected_steps_advance_scores_and_use_remaining_expected_costs(self):
        rows = overall_upgrade_order([], [roll('flames', {0: .5, 10: .25, 20: .25})])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]['current_score'], 15)
        self.assertEqual(rows[1]['target_score'], 20)
        self.assertEqual(rows[1]['expected_score_gain'], 5)
        self.assertEqual(rows[1]['action_cost_mesos'], 4)
        self.assertEqual(rows[1]['cumulative_cost_mesos'], 6)

    @patch('backend.calc.equipment_upgrade._flame_score_distribution')
    def test_equipment_inputs_determine_targets_and_categories_remain_optional(self, distribution):
        distribution.side_effect = lambda level, *args: {0: .5, level / 10: .25, level / 5: .25}
        request = EquipmentUpgradePlanRequest(
            main_stat='STR', secondary_stats=['DEX'], offense_stat='ATT',
            include_overall=True, categories=['flames'],
            flame_weights=FLAME_WEIGHTS, potential_weights=POTENTIAL_WEIGHTS, equipment=[
                {'name': 'Hat', 'slot': 'hat', 'equipment_level': 140,
                 'equipment_type': 'armor', 'boss_equipment': True, 'current_star_force': 0},
                {'name': 'Cape', 'slot': 'cape', 'equipment_level': 250,
                 'equipment_type': 'armor', 'boss_equipment': False, 'current_star_force': 0},
            ],
        ).model_dump()
        result = equipment_upgrade_plan(request)
        rows = result['overall_upgrade_order']['steps']
        self.assertEqual(rows[0]['slot'], 'cape')
        self.assertEqual(rows[0]['target_score'], 25)
        self.assertEqual(rows[0]['equipment_level'], 250)
        self.assertEqual({row['category'] for row in rows}, {'flames'})
        self.assertEqual(set(result['rankings']), {'flames'})
        self.assertEqual(distribution.call_args_list[0].args[0:3], (140, 'armor', True))
        self.assertEqual(distribution.call_args_list[2].args[0:3], (250, 'armor', False))
        request['include_overall'] = False
        self.assertNotIn('overall_upgrade_order', equipment_upgrade_plan(request))

    def test_overall_http_contract_and_cube_sale_costs(self):
        payload = {
            'main_stat': 'STR', 'secondary_stats': [], 'offense_stat': 'ATT',
            'include_overall': True, 'categories': ['potential'],
            'flame_weights': FLAME_WEIGHTS, 'potential_weights': POTENTIAL_WEIGHTS,
            'equipment': [{'name': 'Hat', 'slot': 'hat', 'equipment_level': 200,
                           'equipment_type': 'armor', 'potential_equipment_type': 'hat',
                           'current_star_force': 0}],
        }
        with TestClient(app) as client:
            for cube, price in [('black', 16_500_000), ('red', 9_000_000)]:
                response = client.post('/api/equipment-upgrade-plan', json={
                    **payload, 'cube_type': cube, 'cube_sale': True,
                })
                self.assertEqual(response.status_code, 200, response.text)
                plan = response.json()['overall_upgrade_order']
                self.assertTrue(plan['steps'])
                self.assertLessEqual(len(plan['steps']), plan['step_limit'])
                for step in plan['steps']:
                    self.assertEqual(step['category'], 'potential')
                    self.assertAlmostEqual(step['action_cost_mesos'] / step['expected_attempts'], price)
            invalid = client.post('/api/equipment-upgrade-plan', json={**payload, 'include_overall': 'yes'})
            self.assertEqual(invalid.status_code, 422)
