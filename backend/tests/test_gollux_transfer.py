import unittest
from unittest.mock import patch

from backend.api.main import EquipmentUpgradePlanRequest
from backend.calc import starforce_calculator as sf
from backend.calc.gollux_transfer import _transfer_candidate as transfer_candidate, transfer_candidate as transfer_options
from backend.calc.equipment_upgrade import equipment_upgrade_plan
from backend.calc.overall_upgrade import RollScores, overall_upgrade_order
from backend.tests import test_equipment_upgrade as equipment_tests
from backend.tests.test_laddering import ladder


def state(**updates):
    return ladder(name='Source of Suffering', slot='pendant-1', current_star=26, cap=27,
        spare_star=0, assumed_copy=True, transfer={
            'donor_star': 24, 'tier_up_cost_mesos': 100, 'restore_trace': True,
            'replacement': 10,
            'options': {'mode_by_star': {}, 'safeguard_by_star': {},
                        'shining_starforce_sunday': False, 'mvp_rank': 'none'},
            'donors': [{'star': 26, 'first': sf.StarForceEstimate(100, 1, .2),
                        'renewal_cost': 500, 'renewal_booms': .5}],
        }, **updates)


class GolluxTransferTests(unittest.TestCase):
    rolls = {'potential': {'scores': RollScores({30: 1}), 'cost': 20}}

    def test_recovery_solves_are_shared_across_recipients_and_projection_steps(self):
        value = state()
        value.update(current_star=25, cap=27)
        donor = value['transfer']['donors'][0]
        value['transfer']['donors'].append({**donor, 'star': 27})
        with patch('backend.calc.gollux_transfer.sf.estimate_starforce', wraps=sf.estimate_starforce) as estimate:
            first = transfer_options(value, self.rolls)
            self.assertEqual(estimate.call_count, 3)
            self.assertEqual(transfer_options(value, self.rolls), first)
            self.assertEqual(estimate.call_count, 3)
            value['current_scores']['flames'] += 1
            changed = transfer_options(value, self.rolls)
            self.assertNotEqual(changed['current_score'], first['current_score'])
            self.assertEqual(estimate.call_count, 3)
        value['transfer'].pop('_sf_estimates')
        self.assertEqual(transfer_options(value, self.rolls), changed)

    def test_both_transfer_options_have_recipient_specific_roll_costs(self):
        value = state()
        value.update(current_star=24, cap=25, spare_scores={'flames': 0, 'potential': 999})
        rolls = {**self.rolls, 'flames': {'scores': RollScores({20: 1}), 'cost': 5}}
        row = transfer_options(value, rolls)
        options = {option['transfer_route']: option for option in row['transfer_options']}
        equipped = options['equipped_transfer']
        spare = options['spare_transfer']
        self.assertEqual(equipped['expected_flame_score'], 20)
        self.assertEqual(equipped['flame_roll_cost_mesos'], 0)
        self.assertEqual(equipped['potential_roll_cost_mesos'], 20)
        self.assertEqual(spare['flame_roll_cost_mesos'], 5)
        self.assertEqual(spare['potential_roll_cost_mesos'], 20)
        self.assertEqual(spare['expected_potential_score'], 30)
        for option in options.values():
            self.assertEqual(option['preparation_cost_mesos'], option['tier_up_cost_mesos']
                + option['potential_roll_cost_mesos'] + option['flame_roll_cost_mesos'])
        # The removed checkbox has no effect on either option, including old saves.
        value['transfer']['restore_trace'] = False
        self.assertEqual(transfer_options(value, rolls), row)

    def test_spare_transfer_retains_flame_overwrites_potential_and_loses_one_star(self):
        value = state()
        value.update(current_star=24, assumed_copy=False, spare_scores={'flames': 20, 'potential': 999})
        value['transfer']['restore_trace'] = False
        row = transfer_candidate(value, self.rolls)
        self.assertEqual(row['next_star'], 25)
        self.assertEqual(row['expected_flame_score'], 20)
        self.assertEqual(row['expected_potential_score'], 30)
        self.assertEqual(row['action_cost_mesos'], 220)
        self.assertEqual(row['transfer_route'], 'spare_transfer')
        self.assertEqual(row['expected_sos_booms'], 0)
        self.assertEqual(row['expected_gollux_booms'], .2)
        self.assertIsNone(transfer_candidate(value, {}))
        value['assumed_copy'] = True
        value['spare_scores'] = {'flames': 0, 'potential': 0}
        value['cap'] = 25
        assumed = transfer_candidate(value, {'potential': {'scores': RollScores({60: 1}), 'cost': 20}})
        self.assertTrue(assumed['assumed_second_copy'])
        self.assertEqual(assumed['expected_flame_score'], 0)

    def test_transfer_sequence_does_not_reuse_consumed_inventory(self):
        value = state()
        value.update(current_star=24, assumed_copy=False)
        value['transfer']['restore_trace'] = False
        roll = {'category': 'potential', 'cost': 20, 'distribution': {30: 1},
                'entry': {'slot': value['slot'], 'name': value['name'], 'current_score': 30}}
        rows = overall_upgrade_order([], [roll], laddering_states={value['slot']: value})
        self.assertEqual(len(rows), 1)
        self.assertIn(rows[0]['copy_label'], ('Original', 'Spare'))

    def test_spare_can_be_tapped_after_transfer_but_must_improve_equipped_stars(self):
        value = state()
        value.update(current_star=25, cap=25, assumed_copy=False)
        value['transfer']['restore_trace'] = False
        # Even an enormous potential improvement must not justify losing stars
        # or replacing 25 stars with another 25-star copy.
        rolls = {'potential': {'scores': RollScores({1000: 1}), 'cost': 1}}
        self.assertIsNone(transfer_candidate(value, rolls))
        value['cap'] = 26
        row = transfer_candidate(value, rolls)
        self.assertEqual(row['donor_start'], 24)
        self.assertEqual(row['donor_target'], 26)
        self.assertEqual(row['transfer_star'], 25)
        self.assertEqual(row['next_star'], 26)
        self.assertGreater(row['post_transfer_cost_mesos'], 0)

    def test_post_transfer_recovery_costs_and_donor_consumption(self):
        for use_transfer in (False, True):
            with self.subTest(use_transfer=use_transfer):
                value = state()
                value.update(current_star=25, cap=26, assumed_copy=False)
                value['transfer']['restore_trace'] = False

                def estimate(level, start, target, **kwargs):
                    self.assertEqual((level, start, target), (160, 25, 26))
                    if 'boom_reset_star' in kwargs:
                        self.assertEqual(kwargs['replacement_cost_mesos'], 510)
                        return sf.StarForceEstimate(200 if use_transfer else 2000, 1, 2)
                    self.fail('SoS recovery must always use a transfer')

                with patch('backend.calc.gollux_transfer.sf.estimate_starforce', side_effect=estimate):
                    row = transfer_candidate(value, self.rolls)
                self.assertEqual(row['action_cost_mesos'], (200 if use_transfer else 2000) + 220)
                self.assertEqual(row['preparation_cost_mesos'], 120)
                self.assertEqual(row['expected_transfers'], 3)
                self.assertAlmostEqual(row['expected_booms'], 3.2)
                self.assertEqual(row['expected_sos_booms'], 2)
                self.assertAlmostEqual(row['expected_gollux_booms'], 1.2)
                self.assertEqual(row['protected_star'], 25)

    def test_transfer_then_enhance_applies_across_star_levels(self):
        for equipped in (17, 21, 24, 25, 27):
            with self.subTest(equipped=equipped):
                value = state()
                landing = max(22, equipped)
                value.update(current_star=equipped, cap=landing + 1, assumed_copy=False)
                value['transfer']['restore_trace'] = False
                value['transfer']['donor_star'] = equipped - 1
                value['transfer']['donors'][0]['star'] = landing + 1
                row = transfer_candidate(value, self.rolls)
                self.assertEqual(row['donor_target'], landing + 1)
                self.assertEqual(row['transfer_star'], landing)
                self.assertEqual(row['next_star'], max(equipped + 1, landing))
                if equipped >= 22:
                    self.assertGreater(row['post_transfer_cost_mesos'], 0)
                self.assertGreater(row['expected_score_gain'], 0)

    def test_cheap_fodder_cannot_transfer_below_equipped_stars(self):
        value = state()
        value.update(current_star=25, cap=26, assumed_copy=False)
        value['transfer']['restore_trace'] = False
        donor = value['transfer']['donors'][0]
        value['transfer']['donors'] = [
            {**donor, 'star': star, 'first': sf.StarForceEstimate(0, 0, 0)}
            for star in (24, 25)]
        with patch('backend.calc.gollux_transfer.sf.estimate_starforce') as estimate:
            self.assertIsNone(transfer_candidate(value, self.rolls))
            estimate.assert_not_called()
        value['transfer']['donors'].append(donor)
        row = transfer_candidate(value, self.rolls)
        self.assertEqual(row['donor_target'], 26)
        self.assertEqual(row['transfer_star'], 25)
        self.assertEqual(row['next_star'], 26)

    def test_guaranteed_transfer_beats_cheaper_sos_tapping(self):
        value = state()
        value.update(current_star=24, cap=25)
        value['transfer']['restore_trace'] = False
        donor = value['transfer']['donors'][0]
        value['transfer']['donors'] = [
            {**donor, 'star': 25, 'first': sf.StarForceEstimate(0, 0, 0)},
            {**donor, 'star': 26, 'first': sf.StarForceEstimate(1e12, 100, 999)}]
        with patch('backend.calc.gollux_transfer.sf.estimate_starforce',
                   return_value=sf.StarForceEstimate(1, 1, .1)):
            row = transfer_candidate(value, self.rolls)
        self.assertEqual(row['donor_target'], 26)
        self.assertEqual(row['next_star'], 25)
        self.assertEqual(row['expected_sos_booms'], 0)
        self.assertEqual(row['expected_gollux_booms'], 999)

    def test_no_sos_taps_below_22_even_with_ready_donor(self):
        value = state()
        value.update(current_star=21, cap=24)
        value['transfer']['donor_star'] = 22
        value['transfer']['donors'][0]['star'] = 22
        with patch('backend.calc.gollux_transfer.sf.estimate_starforce') as estimate:
            self.assertIsNone(transfer_candidate(value, self.rolls))
            estimate.assert_not_called()

    def test_pending_transfer_defers_cubes_but_keeps_flames_and_other_items(self):
        value = state()
        value.update(current_star=24, assumed_copy=False)
        value['transfer']['restore_trace'] = False
        rolls = [
            {'category': 'potential', 'cost': 1, 'distribution': {30: .5, 60: .5},
             'entry': {'slot': value['slot'], 'name': value['name'], 'current_score': 30}},
            {'category': 'flames', 'cost': .001, 'distribution': {21: 1},
             'entry': {'slot': value['slot'], 'name': value['name'], 'current_score': 20}},
            {'category': 'potential', 'cost': 1, 'distribution': {10: 1},
             'entry': {'slot': 'hat', 'name': 'Hat', 'current_score': 0}},
        ]
        rows = overall_upgrade_order([], rolls, laddering_states={value['slot']: value})
        self.assertEqual([(row['slot'], row['category']) for row in rows],
                         [('pendant-1', 'flames'), ('hat', 'potential'), ('pendant-1', 'starforce')])
        self.assertIn(rows[-1]['transfer_route'], ('equipped_transfer', 'spare_transfer'))
        self.assertGreater(rows[-1]['preparation_cost_mesos'], 0)

    def test_api_rejects_wrong_item_and_invalid_donor_range(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        request = fixture.plan_request()
        request['equipment'][0]['laddering'] = {'start_star': 17, 'transfer': {'donor_star': 27}}
        with self.assertRaises(ValueError):
            EquipmentUpgradePlanRequest(**request)
        request['equipment'][0]['laddering']['transfer']['donor_star'] = 0
        with self.assertRaises(ValueError):
            EquipmentUpgradePlanRequest(**request)

    def test_full_plan_prices_owned_26_star_donor_and_requires_tier_up_estimate(self):
        fixture = equipment_tests.EquipmentUpgradeTests()
        fixture.setUp()
        request = fixture.plan_request(categories=['starforce', 'potential'], include_overall=True)
        item = request['equipment'][0]
        item.update(name='Source of Suffering', slot='pendant-1', equipment_level=160,
            boss_equipment=True, current_star_force=24, max_star_force=25,
            current_potential=[{'effect': 'STR_PCT', 'value': 13}],
            laddering={'start_star': 24, 'second_copy': {'current_star_force': 0},
                      'transfer': {'donor_star': 26, 'donor_target': 26, 'restore_trace': False,
                                   'tier_up_cost_mesos': 1e9}})
        request = EquipmentUpgradePlanRequest(**request).model_dump()
        plan = equipment_upgrade_plan(request)['overall_upgrade_order']
        transfers = [row for row in plan['steps'] if row.get('transfer_route')]
        self.assertEqual(len(transfers), 1)
        self.assertFalse(any(row['category'] == 'potential' for row in plan['steps']))
        self.assertEqual(transfers[0]['next_star'], 25)
        self.assertGreaterEqual(transfers[0]['action_cost_mesos'], 1e9)
        request['equipment'][0]['laddering']['transfer']['tier_up_cost_mesos'] = None
        plan = equipment_upgrade_plan(request)['overall_upgrade_order']
        self.assertTrue(any('tier-up cost' in row['note'] for row in plan['unavailable']))
