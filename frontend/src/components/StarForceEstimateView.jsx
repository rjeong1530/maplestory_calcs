import { motion, useReducedMotion } from 'framer-motion'
import { CalculatorPanel, SectionHeader, ResultCard } from '../ui/layout'
import { InputField, SelectField, NumberStepper, Toggle, SegmentedControl, PrimaryButton } from '../ui/controls'
import { EmptyState } from '../ui/feedback'
import { LoadingButtonContent } from '../ui/loading'
import AnimatedNumber from '../ui/AnimatedNumber'
import LoadingStatus from './LoadingStatus'
import StarForceBudget from './StarForceBudget'
import StarForceProbabilityChart from './StarForceProbabilityChart'
import { MVP_RANKS } from '../data/equipmentUpgrade'
import { count as formatMesos } from '../data/numberFormat'

const rateFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 4 })
const formatRate = value => rateFormat.format(value)
const formatCount = value => value.toLocaleString('en-US', { maximumFractionDigits: 3 })
const formatProbability = value => `${(value * 100).toFixed(3)}%`

export default function StarForceEstimateView({ form, update, updateStarSetting, submit, busy, error, result, costRows, costsBusy, costsError }) {
  const reduced = useReducedMotion()
  // Adapt the stepper's string value to the existing event handler. Do not parse
  // or clamp here: native constraints and the unchanged handler own that behavior.
  const updateNumber = name => value => update({ target: { name, value, type: 'number' } })
  return <>
    <div className="sf-estimate-layout">
      <form className="starforce-form" onSubmit={submit} aria-label="Star Force settings">
        <fieldset disabled={busy} className="sf-form-grid">
          <legend className="sr-only">Star Force settings</legend>
          <CalculatorPanel title="Item Setup" description="Configure your enhancement estimate." className="sf-setup-panel">
            <div className="grid gap-4">
              <InputField label="Item Level" name="item_level" type="number" min="1" max="300" step="1" value={form.item_level} onChange={update} required />
              <InputField label="Replacement cost per boom (mesos)" name="replacement_cost_mesos" type="number" min="0" max="1000000000000000" step="any"
                value={form.replacement_cost_mesos} onChange={update} required />
            </div>
            <div className="sf-mode-heading"><h3>Enhancement mode</h3><span>Per-star settings</span></div>
            <div className="starforce-mode-table">
              {Array.from({ length: 7 }, (_, index) => index + 15).map(star => <div className="sf-mode-row" key={star}>
                <div className="sf-mode-label"><span>{star}★ → {star + 1}★</span>
                  {star <= 17 ? <label className="sf-safeguard">
                    <input type="checkbox" aria-label={`Safeguard attempt from ${star} stars`} checked={form.safeguard_by_star[star]}
                      onChange={event => updateStarSetting('safeguard_by_star', star, event.target.checked)} />Safeguard
                  </label> : <span className="mw-muted">Safeguard N/A</span>}
                </div>
                <SegmentedControl label={`Enhancement mode from ${star} stars`} className="sf-mode-choices" disabled={busy} value={form.mode_by_star[star]}
                  onChange={value => updateStarSetting('mode_by_star', star, value)}
                  options={(star <= 17 ? [1, 2, 3] : [1, 2, 3, 4]).map(mode => ({ value: String(mode), label: `Mode ${mode}` }))} />
              </div>)}
            </div>
            <p className="mw-help mt-4">Safeguarding applies only to selected 15★–17★ attempts. Boom recovery follows the star-specific rules.</p>
          </CalculatorPanel>

          <CalculatorPanel title="Enhancement target" className="sf-target-panel">
            <div className="sf-item-summary">
              <span className="sf-item-emblem" aria-hidden="true">✦</span>
              <div><h3>Custom equipment</h3><div className="sf-item-tags"><span>Lv. {form.item_level || '—'}</span><span>{form.superior_item ? 'Superior' : 'Standard'} item</span></div></div>
            </div>
            <p className="mw-help mt-3">Set the item level and enhancement settings for this estimate.</p>
            <div className="sf-star-controls">
              <NumberStepper label="Current Star" name="start_star" value={form.start_star} min="0" max="29" step="1" required disabled={busy} onValueChange={updateNumber('start_star')} />
              <span className="sf-star-arrow" aria-hidden="true">→</span>
              <NumberStepper label="Target Star" name="target_star" value={form.target_star} min={Number(form.start_star) + 1} max="30" step="1" required disabled={busy} onValueChange={updateNumber('target_star')} />
            </div>
            <motion.div className="sf-star-trail" aria-hidden="true" key={form.target_star}
              initial={reduced ? false : { textShadow: '0 0 0px #ffb54700' }} animate={reduced ? { textShadow: 'none' } : { textShadow: ['0 0 0px #ffb54700', '0 0 12px #ffb547aa', '0 0 0px #ffb54700'] }} transition={{ duration: reduced ? 0 : .45 }}>
              ★ ★ ★ <span>✦</span> ★ ★ ★
            </motion.div>
            <div className="sf-event-settings">
              <SectionHeader title="Events & settings" />
              <Toggle name="shining_starforce_sunday" label="Shining Star Force Sunday" checked={form.shining_starforce_sunday} onChange={update} />
              <SelectField label="MVP rank" name="mvp_rank" value={form.mvp_rank} onChange={update}>
                {Object.entries(MVP_RANKS).map(([rank, label]) => <option key={rank} value={rank}>{label}</option>)}
              </SelectField>
              <Toggle name="superior_item" label="Superior item (MVP discount excluded)" checked={form.superior_item} onChange={update} />
            </div>
            <PrimaryButton type="submit" className="w-full mt-6" disabled={busy}><LoadingButtonContent busy={busy}>Calculate expected cost</LoadingButtonContent></PrimaryButton>
            <p className="mw-help mt-4">Total cost includes enhancement mesos and expected replacement costs.</p>
          </CalculatorPanel>
        </fieldset>
      </form>

      <ResultCard title="Results" busy={busy} className="starforce-result">
        {busy ? <LoadingStatus variant="result">Calculating expected costs…</LoadingStatus>
          : error ? <p className="error sf-error" role="alert">{error}</p>
            : !result ? <EmptyState title="Set your target" description="Choose an item level and star range to estimate the cost and booms." icon="☆" /> : null}
        <motion.dl className={result ? 'starforce-metrics sf-metrics' : undefined} hidden={!result}
          animate={{ opacity: result ? 1 : 0, scale: reduced || !result ? 1 : [ .98, 1 ] }} transition={{ duration: reduced ? 0 : .2 }}>
          {[
            ['Expected total mesos', result?.expected_cost, formatMesos],
            ['Expected replacement mesos', result?.expected_replacement_cost, formatMesos],
            ['Expected attempts', result?.expected_attempts, formatCount],
            ['Expected booms', result?.expected_booms, formatCount],
            ['Success chance at average cost', result?.budget_distribution?.mean_success_probability, formatProbability],
          ].map(([label, value, format]) => <div key={label} className="mw-stat" hidden={!Number.isFinite(value)}>
            <dt>{label}</dt><dd><AnimatedNumber value={value} format={format} /></dd>
          </div>)}
        </motion.dl>
        {result && <>
          {result.budget_distribution && <>
            <StarForceProbabilityChart distribution={result.budget_distribution} />
            <StarForceBudget result={result} />
          </>}
          <p className="mw-help mt-5">Total mesos include enhancement costs and expected booms multiplied by your replacement cost. The selected Shining Star Force Sunday and MVP discounts are applied to eligible enhancement costs.</p>
        </>}
      </ResultCard>
    </div>

    <div className="sf-breakdown">
      <CalculatorPanel title="Cost per tap" description={`${form.shining_starforce_sunday ? 'Shining on' : 'Shining off'} · Level ${form.item_level || '—'} · MVP: ${MVP_RANKS[form.mvp_rank]}`} className="starforce-cost-panel">
        <p className="mw-help mb-4">Shining Star Force Sunday discounts costs at every star. The selected MVP rank discounts non-Superior equipment on attempts up to 17★. Discounts combine multiplicatively; on safeguarded attempts, they apply to the base-cost portion while the safeguard surcharge remains unchanged.
          {form.superior_item ? ' MVP is excluded for this Superior item.' : ''} The Mode 4 cost column shows safeguard costs from 15★ to 17★; Mode 4 rates are unavailable there.</p>
        {costsBusy ? <LoadingStatus variant="table">Loading tap costs…</LoadingStatus>
          : costsError ? <p className="error sf-error" role="alert">{costsError}</p>
            : costRows && <div className="sf-table-wrap starforce-table-wrap" tabIndex="0" role="region" aria-label="Star Force costs by star">
              <table className="sf-table starforce-table">
                <caption>Mesos per tap for level {form.item_level}; mode costs include the selected event and eligible MVP discount</caption>
                <thead><tr><th scope="col">Transition</th><th scope="col">Base (no discounts)</th>{[1, 2, 3, 4].map(mode => <th scope="col" key={mode}>{mode === 4 ? 'Mode 4 / Safeguard 15★–17★' : `Mode ${mode}`}</th>)}</tr></thead>
                <tbody>{costRows.map(row => <tr key={row.star}><th scope="row">{row.star}★ → {row.star + 1}★</th><td>{formatMesos(row.base_cost)}</td>
                  {[1, 2, 3, 4].map(mode => {
                    // Outside 15–21 stars only Mode 1 is selectable. The fourth
                    // cost column represents safeguard at 15–17, then Mode 4.
                    const available = mode === 1 || (row.star >= 15 && row.star <= 21
                      && (mode !== 4 || row.star >= 18 || Boolean(row.safeguard_rates)))
                    return <td key={mode}>{!available || row.mode_costs[String(mode)] == null ? 'N/A' : formatMesos(row.mode_costs[String(mode)])}</td>
                  })}
                </tr>)}</tbody>
              </table>
            </div>}
      </CalculatorPanel>
      <CalculatorPanel title="Success, fail and boom chances" description={`${form.shining_starforce_sunday ? 'Shining on' : 'Shining off'} · All four modes`} className="starforce-cost-panel">
        <p className="mw-help mb-4">Rates below reflect the selected Shining Star Force Sunday setting ({form.shining_starforce_sunday ? '30% lower boom chance at 15★–21★' : 'no event boom reduction'}).
          MVP rank changes costs, not success or boom chances. Compare modes without safeguard. Mode 4 is unavailable from 15★ to 17★. Rates outside 15★–21★ are identical across modes. Fail excludes booms; failures lose one star from 10★–14★ and 22★ onward, and otherwise keep the current star.</p>
        {costsBusy ? <LoadingStatus variant="table">Loading rates…</LoadingStatus>
          : costsError ? <p className="error sf-error" role="alert">{costsError}</p>
            : costRows && <>
              <div className="sf-table-wrap starforce-table-wrap" tabIndex="0" role="region" aria-label="Star Force rates by mode">
                <table className="sf-table starforce-table sf-rate-table">
                  <caption>Per-attempt chances with Shining Star Force Sunday {form.shining_starforce_sunday ? 'enabled' : 'disabled'}</caption>
                  <colgroup><col className="sf-transition-column" /><col span="12" /></colgroup>
                  <thead><tr><th scope="col" rowSpan="2">Transition</th>{[1, 2, 3, 4].map(mode => <th className="sf-mode-divider" scope="colgroup" colSpan="3" key={mode}>Mode {mode}</th>)}</tr>
                    <tr>{[1, 2, 3, 4].flatMap(mode => ['Success', 'Fail', 'Boom'].map((outcome, index) => <th className={index === 0 ? 'sf-mode-divider' : undefined} scope="col" key={`${mode}-${outcome}`}>{outcome}</th>))}</tr>
                  </thead>
                  <tbody>{costRows.map(row => <tr key={row.star}><th scope="row">{row.star}★ → {row.star + 1}★</th>
                    {[1, 2, 3, 4].flatMap(mode => {
                      const rates = row.mode_rates[String(mode)]
                      return rates ? [rates.success, rates.maintain + rates.downgrade, rates.boom].map((rate, index) => <td className={index === 0 ? 'sf-mode-divider' : undefined} key={`${mode}-${index}`}>{formatRate(rate)}</td>)
                        : [<td className="sf-mode-divider" key={mode} colSpan="3">N/A</td>]
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
              <p className="mw-help mt-4">Safeguard overrides the selected mode with Mode 1 and removes booms:</p>
              <ul className="mw-help">{costRows.filter(row => row.safeguard_rates).map(row => <li key={row.star}>
                {row.star}★ → {row.star + 1}★: success {formatRate(row.safeguard_rates.success)}, fail {formatRate(row.safeguard_rates.maintain + row.safeguard_rates.downgrade)}, boom {formatRate(row.safeguard_rates.boom)}.
              </li>)}</ul>
            </>}
      </CalculatorPanel>
    </div>
  </>
}
