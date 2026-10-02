"""Probability model and bundled data tests."""
import math
import unittest
from unittest.mock import patch
from backend.calc import maplestory_potential as m


class PotentialTests(unittest.TestCase):
    def test_gms_values_preserve_source_probabilities_and_tiers(self):
        for cube in m.CUBE_TYPES:
            for level in (150, 160, 200, 250):
                with self.subTest(cube=cube, level=level):
                    table = m.get_potentials_by_line('weapon', level, cube)
                    prime = 12 if level == 150 else 13
                    unique = prime - 3
                    for effect in ('STR_PCT', 'DEX_PCT', 'INT_PCT', 'LUK_PCT',
                                   'ATT_PCT', 'MAGIC_ATT_PCT', 'DAMAGE_PCT', 'CRIT_RATE_PCT'):
                        self.assertEqual(max(p.effects.get(effect, 0) for p in table[1]), prime)
                        self.assertEqual(max(p.effects.get(effect, 0) for p in table[2]
                                             if p.source_tier == 'Unique'), unique)
                    all_stat = next(p for p in table[1] if p.name.startswith('올스탯'))
                    self.assertEqual(set(all_stat.effects.values()), {unique})
                    self.assertEqual(table[1][0].name, f'STR +{prime}%')
                    raw = m._data()[f'{cube}|weapon|{level}']
                    for line, rows in enumerate(raw, 1):
                        total = math.fsum(prob for _, prob in rows)
                        self.assertEqual([p.probability for p in table[line]],
                                         [prob / total for _, prob in rows])
                    primes = (1, .1, .01) if cube == 'red' else (1, .2, .05)
                    for line, expected in enumerate(primes, 1):
                        self.assertAlmostEqual(sum(p.probability for p in table[line]
                            if p.source_tier == 'Legendary'), expected, delta=.00002)

    def test_gms_exceptions_and_source_data_are_unchanged(self):
        for level in (160, 200):
            hat = m.get_potentials_by_line('hat', level)
            for effect in ('MAX_HP_PCT', 'MAX_MP_PCT'):
                self.assertEqual(max(p.effects.get(effect, 0) for p in hat[1]), 13)
                self.assertEqual(max(p.effects.get(effect, 0) for p in hat[2]
                                     if p.source_tier == 'Unique'), 10)
            weapon = m.get_potentials_by_line('weapon', level)
            for effect in ('BOSS_DAMAGE_PCT', 'IED_PCT'):
                self.assertEqual(max(p.effects.get(effect, 0) for p in weapon[1]), 40)
            gloves = m.get_potentials_by_line('gloves', level)
            self.assertEqual(max(p.effects.get('CRIT_DAMAGE_PCT', 0) for p in gloves[1]), 8)
            self.assertEqual(m._data()[f'black|hat|{level}'][0][0][0], 'STR +12%')
            self.assertEqual(m.get_potentials_by_line('hat', level), hat)
        self.assertEqual(m.probability_exact('STR_PCT', 39, level=150), 0)
        self.assertGreater(m.probability_exact('STR_PCT', 39, level=160), 0)
        self.assertIn(39, m.weighted_score_distribution({'STR_PCT': 1}, level=160))

    def test_multiple_targets_on_same_roll(self):
        p = m.Potential
        table = {
            1: [p(1, 'Legendary', 'crit', .5, {'CRIT_DAMAGE_PCT': 8}),
                p(1, 'Legendary', 'str', .5, {'STR_PCT': 12})],
            2: [p(2, 'Unique', 'all stat', .5, {'STR_PCT': 6, 'DEX_PCT': 6}),
                p(2, 'Unique', 'other', .5, {})],
            3: [p(3, 'Unique', 'other', 1, {})],
        }
        with patch.object(m, 'get_potentials_by_line', return_value=table):
            self.assertEqual(m.probability_at_least('CRIT_DAMAGE_PCT', 8), .5)
            self.assertEqual(m.probability_at_least('CRIT_DAMAGE_PCT', 8, 'STR_PCT', 6), .25)
            self.assertEqual(m.probability_at_least('CRIT_DAMAGE_PCT', 8, 'STR_PCT', 12), 0)
            self.assertEqual(m.probability_at_least(
                'CRIT_DAMAGE_PCT', 8, 'STR_PCT', 6, 'DEX_PCT', 6), .25)

    def test_multiple_target_validation(self):
        for extra in [('ATT_PCT',), ('typo', 1), ('STR_PCT', float('nan')),
                      ('STR_PCT', float('inf')), ('COOLDOWN_SEC', -4)]:
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                m.probability_at_least('STR_PCT', 13, *extra)

    def test_weighted_score_distribution(self):
        potential = m.Potential
        table = {
            1: [potential(1, 'Legendary', 'crit', .5, {'CRIT_DAMAGE_PCT': 8}),
                potential(1, 'Legendary', 'str', .5, {'STR_PCT': 12})],
            2: [potential(2, 'Unique', 'att', 1, {'ATT_PCT': 9})],
            3: [potential(3, 'Unique', 'none', 1, {})],
        }
        with patch.object(m, 'get_potentials_by_line', return_value=table):
            distribution = m.weighted_score_distribution({
                'CRIT_DAMAGE_PCT': 2, 'STR_PCT': 1, 'ATT_PCT': 3,
            })
        self.assertEqual(distribution, {39.0: .5, 43.0: .5})

    def test_weighted_score_distribution_rejects_invalid_weights(self):
        for weights in ({'unknown': 1}, {'STR_PCT': -1}, {'STR_PCT': float('inf')}):
            with self.subTest(weights=weights), self.assertRaises(ValueError):
                m.weighted_score_distribution(weights)

    def test_cooldown_reduction_target(self):
        self.assertAlmostEqual(m.probability_at_least('COOLDOWN_SEC', 4),
                               m.probability_cooldown_at_least(4))
        chance = m.probability_at_least('STR_PCT', 13, 'COOLDOWN_SEC', 4, level=250)
        self.assertGreater(chance, 0)
        self.assertLessEqual(chance, m.probability_cooldown_at_least(4, level=250))

    def test_shield_categories(self):
        for cube in m.CUBE_TYPES:
            for level in m.SUPPORTED_LEVELS:
                force = m._data()[f'{cube}|force shield|{level}']
                self.assertEqual(force, m._data()[f'{cube}|soul ring|{level}'])
                for equipment in ('force shield', 'soul ring', 'shield'):
                    self.assertIn(f'{cube}|{equipment}|{level}', m._data())
            for equipment in ('force shield', 'soul ring', 'shield'):
                self.assertGreater(m.probability_at_least('ATT_PCT', 21,
                    equipment_type=equipment, level=150, cube_type=cube), 0)
        self.assertEqual(m.get_potentials_by_line('force_shield'),
                         m.get_potentials_by_line('force shield'))

    def test_all_tables_and_complete_roll_mass(self):
        for key, raw in m._data().items():
            cube, equipment, level = key.split('|')
            with self.subTest(key=key):
                if raw is None:
                    with self.assertRaises(ValueError):
                        m.get_potentials_by_line(equipment, int(level), cube)
                    continue
                table = m.get_potentials_by_line(equipment, int(level), cube)
                for rows in raw:
                    self.assertAlmostEqual(sum(p for _, p in rows), 1, delta=0.0001)
                self.assertAlmostEqual(math.fsum(p for _, p in m._rolls(table)), 1)

    def test_restrictions_and_conditional_probability(self):
        p = m.Potential
        table = {
            1: [p(1, 'Legendary', 'skill', .5, {}, 'decent_skill'), p(1, 'Legendary', 'stat', .5, {})],
            2: [p(2, 'Unique', 'skill', .5, {}, 'decent_skill'), p(2, 'Unique', 'stat', .5, {})],
            3: [p(3, 'Unique', 'stat', 1, {})],
        }
        rolls = list(m._rolls(table))
        self.assertEqual(len(rolls), 3)
        self.assertEqual([prob for _, prob in rolls], [.5, .25, .25])

    def test_cube_tiers(self):
        for cube, primes in [('red', (1, .1, .01)), ('black', (1, .2, .05))]:
            table = m.get_potentials_by_line('hat', 150, cube)
            for line, prime in enumerate(primes, 1):
                self.assertAlmostEqual(sum(p.probability for p in table[line]
                    if p.source_tier == 'Legendary'), prime, delta=.00002)

    def test_equipment_and_level_effects(self):
        self.assertGreater(m.probability_at_least('ATT_PCT', 30, equipment_type='weapon'), 0)
        self.assertEqual(m.probability_at_least('ATT_PCT', 1, equipment_type='hat'), 0)
        self.assertGreater(m.probability_at_least('CRIT_DAMAGE_PCT', 8, equipment_type='gloves'), 0)
        self.assertEqual(m.probability_cooldown_at_least(1, equipment_type='shoes'), 0)
        self.assertGreater(m.probability_cooldown_at_least(2), 0)
        self.assertEqual(m.get_potentials_by_line('hat', 100)[1][0].effects['STR_PCT'], 12)
        self.assertGreater(m.probability_at_least('BOSS_DAMAGE_PCT', 40, equipment_type='weapon'), 0)
        self.assertGreater(m.probability_at_least('IED_PCT', 40, equipment_type='emblem'), 0)
        self.assertEqual(m.get_potentials_by_line('hat', 250)[1][0].effects['STR_PCT'], 13)

    def test_matching_and_exact(self):
        matches = m.matching_combinations('STR_PCT', 30, mode='exact')
        self.assertAlmostEqual(sum(x['probability'] for x in matches), m.probability_exact('STR_PCT', 30))
        self.assertGreaterEqual(m.probability_at_least('STR_PCT', 30), m.probability_exact('STR_PCT', 30))
        self.assertEqual(m.probability_at_least('STR_PCT', 1000), 0)

    def test_validation(self):
        for options in [dict(level=99), dict(equipment_type='bad'), dict(cube_type='bad')]:
            with self.assertRaises(ValueError):
                m.probability_at_least('STR_PCT', 30, **options)
        with self.assertRaises(ValueError):
            m.probability_at_least('typo', 30)
        with self.assertRaises(ValueError):
            m.matching_combinations('STR_PCT', 1000, 'bad')
        self.assertEqual(m.cubes_for_probability(.5, .75), 2)

    def test_ied_stacking(self):
        p = m.Potential(1, 'Legendary', 'IED', 1, {'IED_PCT': 40})
        self.assertAlmostEqual(m._total((p, p), 'IED_PCT'), 64)


if __name__ == '__main__':
    unittest.main()
