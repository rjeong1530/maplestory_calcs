import { useState } from 'react'
import { FLAME_CONFIDENCES, flamesForConfidence, formatFlameChance, costForConfidence } from '../data/flameUpgrade'

const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function ItemIcon({ item, name }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return item?.icon && item.icon !== failedUrl
    ? <img src={item.icon} alt="" width="36" height="36" loading="lazy"
      onError={() => setFailedUrl(item.icon)} />
    : <span className="flame-icon-fallback" aria-hidden="true">{name.slice(0, 2)}</span>
}

export default function FlameUpgradeOrder({ rows, equipment, flameType, costPerFlame, unavailable = [] }) {
  const label = flameType === 'abyssal' ? 'Abyssal Flames' : 'Black Flames'
  return <section className="flame-upgrade-order" aria-label={label}>
    <div className="flame-order-heading">
      <h3 className="flame-type-badge">
        <img src={`/images/flames/${flameType}.png`} alt="" width="32" height="34" />
        {label}
      </h3>
      <p className="hint">Highest chance of improvement first. Each percentage is the chance per flame
        of beating that item's current score.</p>
      {costPerFlame != null && <p className="hint">{count.format(costPerFlame)} mesos per flame.</p>}
    </div>
    <ol className="flame-order-strip" aria-label={label + ' upgrade order'}>
      {rows.map(entry => <li key={entry.slot}>
        <a className="flame-order-item" href={'#flame-upgrade-' + flameType + '-' + entry.slot}
          title={entry.name + ' / ' + entry.slot + ' / Score ' + entry.current_score}
          aria-label={entry.name + ' (' + entry.slot + '): ' + formatFlameChance(entry.improvement_probability) + ' chance of improvement'}>
          <ItemIcon item={equipment[entry.slot]} name={entry.name} />
          <span>{formatFlameChance(entry.improvement_probability)}</span>
        </a>
      </li>)}
    </ol>
    {rows.length ? <div className={'flame-confidence-charts' + (costPerFlame == null ? ' flame-count-only' : '')}>
      {(costPerFlame == null ? ['count'] : ['count', 'cost']).map(metric => <div className="flame-confidence" key={metric}>
        <h4 id={flameType + '-' + metric + '-heading'}>{metric === 'count'
          ? 'Flames needed for an X% chance of a better result'
          : 'Meso cost for an X% chance of a better result'}</h4>
        <div className="flame-confidence-scroll" role="region" aria-labelledby={flameType + '-' + metric + '-heading'} tabIndex="0">
          <table className="flame-confidence-table">
            <thead><tr><th scope="col"><span className="flame-sr-only">Equipment</span></th>
              {FLAME_CONFIDENCES.map(confidence => <th scope="col" key={confidence}>{confidence * 100}%</th>)}
            </tr></thead>
            <tbody>{rows.map(entry => <tr key={entry.slot}
              id={metric === 'count' ? 'flame-upgrade-' + flameType + '-' + entry.slot : undefined} tabIndex="-1">
              <th scope="row" title={entry.name + ' (' + entry.slot + ')'}>
                <ItemIcon item={equipment[entry.slot]} name={entry.name} />
                <span className="flame-sr-only">{entry.name} ({entry.slot})</span>
              </th>
              {FLAME_CONFIDENCES.map(confidence => {
                const value = metric === 'count'
                  ? flamesForConfidence(entry.improvement_probability, confidence)
                  : costForConfidence(entry.improvement_probability, confidence, costPerFlame)
                return <td key={confidence} title={value == null ? 'Unavailable'
                  : count.format(value) + (metric === 'cost' ? ' mesos' : ' flames')}>
                  {value == null ? '\u2014' : (metric === 'cost' ? mesos : count).format(value)}
                </td>
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </div>)}
      <p className="hint flame-confidence-note">These are odds of at least one better roll, not guarantees.
        {costPerFlame != null && <> Cost is the number of flames shown multiplied by the fixed price per flame.
          M = million; B = billion; T = trillion mesos.</>}</p>
    </div> : <p className="hint">No eligible improvements for {label}.</p>}
    {unavailable.length > 0 && <details className="upgrade-notes">
      <summary>Unavailable {label} estimates ({unavailable.length})</summary>
      <ul>{unavailable.map(entry => <li key={entry.slot}>{entry.name} ({entry.slot}): {entry.note}</li>)}</ul>
    </details>}
  </section>
}
