"""Compare finite SoS upgrade bundles with repeatable, priced replacements.

Potential is rebuilt after Star Force finishes, not on every destruction.
The first donor is owned; later donors must be acquired and rebuilt from zero.
"""
from backend.calc import starforce_calculator as sf
from backend.calc.laddering import automatic_preparation, _preparation_options


def _priority(row):
    return row['expected_sos_booms'], row['action_cost_mesos'] > 0, -row['gain_per_meso']


def configure_transfer(state, item, request):
    settings = item['laddering']['transfer']
    if settings['tier_up_cost_mesos'] is None:
        raise ValueError('Enter the expected Epic-to-Legendary tier-up cost for Gollux transfers (0 only if free).')
    state['transfer'] = dict(settings)
    # Transfer protection applies immediately, including below the ladder threshold.
    state['active'] = True
    state['transfer']['replacement'] = item.get('replacement_cost_mesos') or 0
    state['transfer']['options'] = {
        'shining_starforce_sunday': request.get('shining_starforce_sunday', False),
        'mvp_rank': request.get('mvp_rank', 'none'),
        'mode_by_star': item.get('mode_by_star', {}),
        'safeguard_by_star': item.get('safeguard_by_star', {}),
    }
    donors = []
    for target in range(max(23, settings['donor_star'], state['current_star'] + 1),
                        min(settings['donor_target'], state['cap'] + 1) + 1):
        full = sf.estimate_starforce(150, 0, target,
            replacement_cost_mesos=settings['donor_cost_mesos'], **state['transfer']['options'])
        first = sf.estimate_starforce(150, settings['donor_star'], target,
            replacement_cost_mesos=settings['donor_cost_mesos'], **state['transfer']['options']) if target > settings['donor_star'] else sf.StarForceEstimate(0, 0, 0)
        donors.append({'star': target, 'first': first,
                       'renewal_cost': full.expected_cost + settings['donor_cost_mesos'],
                       'renewal_booms': full.expected_booms})
    state['transfer']['donors'] = donors


def transfer_candidate(state, rolls):
    spare = _transfer_candidate(state, rolls)
    equipped_state = {**state, 'spare_star': state['current_star'], 'assumed_copy': False,
                      'spare_scores': {'flames': state['current_scores']['flames'], 'potential': 0}}
    equipped = _transfer_candidate(equipped_state, {key: value for key, value in rolls.items() if key != 'flames'})
    if equipped:
        equipped.update(transfer_route='equipped_transfer', laddering=False)
    options = [row for row in (equipped, spare) if row is not None]
    if not options:
        return None
    best = min(options, key=_priority)
    return {**best, 'transfer_options': options}


def _transfer_candidate(state, rolls):
    if state.get('blocked') or 'potential' not in rolls:
        return None
    config = state['transfer']
    current = state['current_star']
    initial = state['sf_scores'][current] + sum(state['current_scores'].values())
    best = None
    current_rolls = {'flames': state['spare_scores']['flames'], 'potential': 0}
    preparation_options = _preparation_options(current_rolls, rolls)
    prepared_targets = {}
    # Request-local cache: Star Force costs do not change when score/roll
    # projections change. Share solves across recipients and planning steps.
    estimates = config.setdefault('_sf_estimates', {})

    def consider(route, target, flame, potential, cost, booms, **details):
        nonlocal best
        final = state['sf_scores'][target] + flame + potential
        gain = final - initial
        if gain <= 1e-9:
            return
        sos_booms = details['expected_sos_booms']
        row = {'name': state['name'], 'slot': state['slot'], 'category': 'starforce',
               'transfer_route': route, 'laddering': route == 'spare_transfer',
               'start_star': current, 'next_star': target, 'current_score': initial,
               'expected_final_score': final, 'expected_score_gain': gain,
               'expected_flame_score': flame, 'expected_potential_score': potential,
               'action_cost_mesos': cost, 'gain_per_meso': gain / cost if cost else 0,
               'expected_booms': booms, **details,
               'expected_sos_booms': sos_booms,
               'expected_gollux_booms': max(0, booms - sos_booms)}
        # Protect scarce SoS copies first; meso efficiency breaks risk ties.
        if best is None or _priority(row) < _priority(best):
            best = row

    # Transfer overwrites spare potential, but its actual flame survives.
    for donor in config['donors']:
        landing = donor['star'] - 1
        # Fodder must recover at least the equipped star level. Cheaper
        # donors must not trade extra SoS catch-up booms for lower cost.
        if landing < max(22, current, state['spare_star']):
            continue
        # The final spare must improve equipped stars. The transfer itself
        # may land below that target, with remaining stars tapped on SoS.
        for target in range(max(current + 1, landing), min(state['cap'], max(current + 6, landing)) + 1):
            if target not in prepared_targets:
                prepared_targets[target] = automatic_preparation(current_rolls,
                    initial - state['sf_scores'][target], rolls, preparation_options)
            prepared = prepared_targets[target]
            if prepared is None:
                continue
            extra_cost = extra_booms = sos_booms = extra_transfers = 0
            recovery = 'none'
            if target > landing:
                key = (landing, target, donor['renewal_cost'])
                if key not in estimates:
                    estimates[key] = sf.estimate_starforce(160, landing, target, boom_reset_star=landing,
                        replacement_cost_mesos=config['replacement'] + donor['renewal_cost'], **config['options'])
                transferred = estimates[key]
                extra_cost = transferred.expected_cost
                sos_booms = extra_transfers = transferred.expected_booms
                extra_booms = sos_booms * (1 + donor['renewal_booms'])
                recovery = 'restore_then_transfer'
            prep = sum(value['cost'] for value in prepared.values()) + config['tier_up_cost_mesos']
            consider('spare_transfer', target, prepared['flames']['score'], prepared['potential']['score'],
                donor['first'].expected_cost + extra_cost + prep, donor['first'].expected_booms + extra_booms,
                donor_target=donor['star'], donor_start=config['donor_star'], transfer_star=landing,
                assumed_second_copy=state['assumed_copy'],
                post_transfer_cost_mesos=extra_cost, spare_recovery=recovery, expected_sos_booms=sos_booms,
                preparation_cost_mesos=prep, minimum_flame_score=prepared['flames']['minimum'],
                potential_roll_cost_mesos=prepared['potential']['cost'],
                flame_roll_cost_mesos=prepared['flames']['cost'],
                tier_up_cost_mesos=config['tier_up_cost_mesos'],
                minimum_potential_score=prepared['potential']['minimum'],
                protected_star=current, boom_transfer_probability=1, expected_transfers=1 + extra_transfers)

    return best
