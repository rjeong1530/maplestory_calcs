from copy import deepcopy
import unittest

from backend.api.main import EquipmentUpgradePlanRequest
from backend.calc.equipment_upgrade import equipment_upgrade_plan
from backend.calc.laddering import automatic_preparation, ladder_candidate, prepare_score
from backend.calc.overall_upgrade import RollScores, overall_upgrade_order
from backend.tests import test_equipment_upgrade as equipment_tests
from backend.tests.test_overall_upgrade import roll, star


def ladder(**updates):
    value = dict(name='Hat', slot='hat', start_star=17, current_star=17, spare_star=0, cap=18,
        sf_scores=[10 * i for i in range(31)],
        steps=[dict(action_cost_mesos=10, expected_attempts=1, expected_booms=.1,
                    expected_replacement_cost=2) for _ in range(30)],
        current_scores={'flames': 20, 'potential': 30}, spare_scores={'flames': 20, 'potential': 30})
    return {**value, **updates}


class LadderingTests(unittest.TestCase):
    def test_automatic_preparation_matches_exhaustive_search(self):
        from random import Random
        random = Random(42)
        for _ in range(80):
            current = {category: random.uniform(0, 12) for category in ('flames', 'potential')}
            rolls = {category: {'scores': RollScores({score: .2 for score in random.sample(range(1, 40), 5)}),
                                'cost': random.randint(1, 25)} for category in current if random.random() > .2}
            required = random.uniform(0, 90)
            options = {category: [value] + ([score for score in rolls[category]['scores'].scores if score > value]
                       if category in rolls else []) for category, value in current.items()}
            costs = []
            for flame in options['flames']:
                for potential in options['potential']:
                    if flame + potential > required + 1e-9:
                        costs.append(prepare_score(current['flames'], flame, rolls.get('flames'))['cost']
                                   + prepare_score(current['potential'], potential, rolls.get('potential'))['cost'])
            result = automatic_preparation(current, required, rolls)
            if costs:
                self.assertIsNotNone(result)
                self.assertAlmostEqual(sum(row['cost'] for row in result.values()), min(costs))
                self.assertGreater(sum(row['minimum'] for row in result.values()), required)
            else:
                self.assertIsNone(result)

    def test_slime_ring_at_24_enforces_laddering_despite_saved_global_off(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        potential = [{'effect': 'STR_PCT', 'value': value} for value in (13, 10, 10)]
        item = dict(name='Guardian Angel Ring', slot='ring-2', equipment_level=160,
            equipment_type='armor', potential_equipment_type='accessory', current_star_force=24,
            max_star_force=25, current_potential=potential,
            laddering=dict(start_star=24, minimum_flame_score=0, minimum_potential_score=0,
                second_copy=dict(current_star_force=12, current_flames=[], current_potential=potential)))
        request = fixture.plan_request(equipment=[item], categories=['starforce'],
            include_overall=True, laddering_enabled=False)
        plan = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())['overall_upgrade_order']
        self.assertTrue(plan['laddering_enabled'])
        self.assertEqual(plan['laddering_status'], [dict(slot='ring-2', enforced=True, upgrade_selected=True, note=None)])
        self.assertEqual(len(plan['steps']), 1)
        row = plan['steps'][0]
        self.assertTrue(row['laddering'])
        self.assertEqual((row['protected_star'], row['start_star'], row['next_star']), (24, 12, 25))
        request['equipment'][0]['max_star_force'] = 24
        plan = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())['overall_upgrade_order']
        self.assertEqual(plan['steps'], [])
        self.assertTrue(plan['laddering_status'][0]['enforced'])
        self.assertFalse(plan['laddering_status'][0]['upgrade_selected'])

    def test_catchup_cost_counts_all_spare_stars_but_gain_only_equipped_delta(self):
        state = ladder()
        row = ladder_candidate(state, {})
        self.assertEqual(row['action_cost_mesos'], 180)
        self.assertEqual(row['expected_score_gain'], 10)
        self.assertEqual(row['protected_star'], 17)
        self.assertEqual((row['start_star'], row['next_star']), (0, 18))
        self.assertAlmostEqual(row['expected_booms'], 1.8)
        self.assertEqual(row['expected_replacement_cost'], 36)

    def test_minimum_roll_costs_and_conditional_outcomes_are_included(self):
        state = ladder(spare_scores={'flames': 0, 'potential': 0})
        rolls = {'flames': {'scores': RollScores({0: .5, 20: .25, 30: .25}), 'cost': 3},
                 'potential': {'scores': RollScores({0: .5, 30: .5}), 'cost': 22}}
        row = ladder_candidate(state, rolls)
        self.assertEqual(row['preparation_cost_mesos'], 50)
        self.assertEqual(row['action_cost_mesos'], 230)
        self.assertEqual(row['expected_flame_score'], 25)
        self.assertEqual(row['expected_score_gain'], 15)
        self.assertEqual(row['minimum_score_gain'], 10)
        self.assertEqual(row['expected_cubes'], 2)
        self.assertIsNone(ladder_candidate(state, {}))
        rolls['flames']['scores'] = RollScores({0: 1})
        self.assertIsNone(ladder_candidate(state, rolls))

    def test_worse_rolls_cannot_count_as_an_upgrade_or_rely_on_lucky_overshoot(self):
        state = ladder(spare_scores={'flames': 0, 'potential': 0})
        self.assertIsNone(ladder_candidate(state, {}))
        row = ladder_candidate(state, {'flames': {'scores': RollScores({1: .5, 1000: .5}), 'cost': 3}})
        self.assertEqual(row['minimum_flame_score'], 1000)
        self.assertGreater(row['minimum_score_gain'], 0)

    def test_two_copies_alternate_and_original_inputs_are_unchanged(self):
        state = ladder(cap=19)
        state['sf_scores'][18:20] = [300, 310]
        state['steps'][18]['action_cost_mesos'] = 1000
        before = deepcopy(state)
        rows = overall_upgrade_order([], [], laddering_states={'hat': state})
        self.assertEqual([(r['protected_star'], r['start_star'], r['next_star']) for r in rows],
                         [(17, 0, 18), (18, 17, 19)])
        self.assertEqual(rows[1]['action_cost_mesos'], 1010)
        self.assertEqual([row['copy_label'] for row in rows], ['Spare', 'Original'])
        self.assertEqual([row['protected_copy_label'] for row in rows], ['Original', 'Spare'])
        self.assertEqual(state, before)
        rows = overall_upgrade_order([], [roll('potential', {100: 1}, current=30, cost=1000)],
            limit=2, laddering_states={'hat': ladder(spare_star=18)})
        self.assertTrue(rows[0]['laddering'])
        self.assertEqual(rows[1]['category'], 'potential')
        self.assertEqual(rows[1]['copy_label'], 'Spare')

    def test_standard_steps_stop_at_threshold_and_existing_spare_can_swap_for_free(self):
        state = ladder(current_star=16, start_star=17, spare_star=18)
        rows = overall_upgrade_order([star(16, 10, current_star=16), star(17, 100, current_star=16)], [],
                                     laddering_states={'hat': state})
        self.assertFalse(rows[0].get('laddering', False))
        self.assertEqual(rows[0]['next_star'], 17)
        self.assertTrue(rows[1]['laddering'])
        self.assertEqual(rows[1]['action_cost_mesos'], 0)
        self.assertEqual(rows[1]['expected_booms'], 0)

    def test_equipment_integration_and_invalid_configuration(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        request = fixture.plan_request(categories=['starforce'], include_overall=True)
        item = request['equipment'][0]
        item.update(current_star_force=17, max_star_force=18, current_flames=[], current_potential=[],
                    laddering=dict(start_star=17, minimum_flame_score=0, minimum_potential_score=0))
        standard_request = deepcopy(request)
        del standard_request['equipment'][0]['laddering']
        standard = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**standard_request).model_dump())
        request['laddering_enabled'] = True
        result = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())
        self.assertEqual(result['rankings'], standard['rankings'])
        row = result['overall_upgrade_order']['steps'][0]
        self.assertTrue(row['laddering'])
        self.assertGreater(row['action_cost_mesos'], standard['overall_upgrade_order']['steps'][0]['action_cost_mesos'])
        self.assertTrue(row['assumed_second_copy'])
        for key, value in [('start_star', 31), ('second_copy', {'current_star_force': -1}), ('minimum_flame_score', float('nan')),
                           ('minimum_potential_score', True)]:
            changed = deepcopy(request)
            changed['equipment'][0]['laddering'][key] = value
            with self.assertRaises(ValueError):
                EquipmentUpgradePlanRequest(**changed)

    def test_recorded_second_copy_uses_actual_lines_and_reacts_to_weights(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        request = fixture.plan_request(categories=['starforce'], include_overall=True, laddering_enabled=True)
        item = request['equipment'][0]
        item.update(current_star_force=17, max_star_force=18, current_flames=[], current_potential=[],
            laddering={'start_star': 17, 'minimum_flame_score': 0, 'minimum_potential_score': 0,
                'second_copy': {'current_star_force': 17, 'current_flames': [],
                                'current_potential': [{'effect': 'STR_PCT', 'value': 12}]}})
        result = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())
        first = result['overall_upgrade_order']['steps'][0]
        self.assertFalse(first['assumed_second_copy'])
        self.assertEqual(first['spare_potential_score'], 120)
        self.assertEqual(first['action_cost_mesos'], 0)  # Better roll, same stars: swap now.
        self.assertEqual(first['next_star'], 17)
        request['potential_weights']['base_stat_pct_value'] = 20
        result = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())
        self.assertEqual(result['overall_upgrade_order']['steps'][0]['spare_potential_score'], 240)

    def test_unrecorded_second_copy_starts_at_zero_and_ignores_legacy_minimums(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        request = fixture.plan_request(categories=['starforce'], include_overall=True, laddering_enabled=True)
        request['equipment'][0].update(current_star_force=17, max_star_force=18, current_potential=[], current_flames=[],
            laddering={'start_star': 17, 'minimum_flame_score': 0, 'minimum_potential_score': 100})
        result = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())
        row = result['overall_upgrade_order']['steps'][0]
        self.assertEqual(row['start_star'], 0)
        self.assertEqual(row['spare_potential_score'], 0)
        self.assertEqual(row['preparation_cost_mesos'], 0)

    def test_automatic_targets_choose_cheapest_attainable_pair_and_require_strict_gain(self):
        rolls = {'flames': {'scores': RollScores({0: .5, 20: .5}), 'cost': 3},
                 'potential': {'scores': RollScores({0: .5, 30: .5}), 'cost': 22}}
        prepared = automatic_preparation({'flames': 0, 'potential': 0}, 15, rolls)
        self.assertEqual(prepared['flames']['minimum'], 20)
        self.assertEqual(prepared['potential']['minimum'], 0)
        prepared = automatic_preparation({'flames': 0, 'potential': 0}, 30, rolls)
        self.assertEqual(prepared['flames']['minimum'], 20)
        self.assertEqual(prepared['potential']['minimum'], 30)
        self.assertIsNone(automatic_preparation({'flames': 0, 'potential': 0}, 50, rolls))
        self.assertIsNone(automatic_preparation({'flames': 0, 'potential': 0}, 0, {}))
        row = ladder_candidate(ladder(spare_scores={'flames': 0, 'potential': 0}), rolls)
        self.assertGreater(row['minimum_score_gain'], 0)
        self.assertGreater(row['preparation_cost_mesos'], 0)

    def test_unavailable_preparation_never_falls_back_to_risky_equipped_starforce(self):
        state = ladder(spare_scores={'flames': 0, 'potential': 0})
        notes = []
        rows = overall_upgrade_order([star(17, 10, current_star=17)], [],
            laddering_states={'hat': state}, laddering_notes=notes)
        self.assertEqual(rows, [])
        self.assertFalse(any(row.get('category') == 'starforce' for row in rows))
