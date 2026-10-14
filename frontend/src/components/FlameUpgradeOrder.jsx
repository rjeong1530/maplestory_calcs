import { useState } from 'react'
import { FLAME_CONFIDENCES, flamesForConfidence, formatFlameChance, costForConfidence } from '../data/flameUpgrade'

const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function ItemIcon({ item, name }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return item?.icon && item.icon !== failedUrl
    ? <img src={item.icon} alt="" width="36" height="36" loading="lazy"
      onError={() => setFailedUrl(item.icon)} />
    : <span className="inline-grid place-items-center size-9 rounded-md bg-rule" aria-hidden="true">{name.slice(0, 2)}</span>
}

export default function FlameUpgradeOrder({ rows, equipment, flameType, costPerFlame, unavailable = [] }) {
  const label = flameType === 'abyssal' ? 'Abyssal Flames' : 'Black Flames'
  return <section className="flame-upgrade-order [&_img]:object-contain [&_img]:[image-rendering:pixelated] [&_img]:[vertical-align:middle]" aria-label={label}>
    <div className="text-center">
      <h3 className="flame-type-badge py-2.5 px-5.5 mt-1 mx-0 mb-3.5 border border-solid border-[#a0967c] rounded-[7px] bg-[#646258]
        text-[14px] font-semibold inline-flex items-center gap-2">
        <img src={`/images/flames/${flameType}.png`} alt="" width="32" height="34" />
        {label}
      </h3>
      <p className="hint text-[12px] text-muted mb-4.5">Highest chance of improvement first. Each percentage is the chance per flame
        of beating that item's current score.</p>
      {costPerFlame != null && <p className="hint text-[12px] text-muted mb-4.5">{count.format(costPerFlame)} mesos per flame.</p>}
    </div>
    <ol className="flame-order-strip flex flex-wrap gap-y-4.5 gap-x-0 list-none py-2 px-0 mt-5 mx-0 mb-10 [&_li]:flex
        [&_li]:items-center [&_li:not(:last-child)::after]:[content:'›'] [&_li:not(:last-child)::after]:text-[#d0cec3]
        [&_li:not(:last-child)::after]:text-[26px] [&_li:not(:last-child)::after]:my-0
        [&_li:not(:last-child)::after]:mx-2" aria-label={label + ' upgrade order'}>
      {rows.map(entry => <li key={entry.slot}>
        <a className="flame-order-item flex flex-col items-center gap-1.75 min-w-14.5 p-1.25 rounded-[6px] text-[#eeede6]
        no-underline text-[12px] tabular-nums [&:hover]:bg-[#3c3a32] [&:hover]:[outline:2px_solid_#a0967c]
        [&:focus-visible]:bg-[#3c3a32] [&:focus-visible]:[outline:2px_solid_#a0967c]" href={'#flame-upgrade-' + flameType + '-' + entry.slot}
          title={entry.name + ' / ' + entry.slot + ' / Score ' + entry.current_score}
          aria-label={entry.name + ' (' + entry.slot + '): ' + formatFlameChance(entry.improvement_probability) + ' chance of improvement'}>
          <ItemIcon item={equipment[entry.slot]} name={entry.name} />
          <span>{formatFlameChance(entry.improvement_probability)}</span>
        </a>
      </li>)}
    </ol>
    {rows.length ? <div className={"flame-confidence-charts grid grid-cols-2 gap-4 [@media(max-width:800px)]:grid-cols-1 [&_.flame-confidence]:w-full [&_.flame-confidence]:min-w-0 [&_.flame-confidence]:max-w-none [&_.flame-confidence-note]:col-span-full [&.flame-count-only]:grid-cols-[minmax(0,_510px)] [&.flame-count-only]:justify-center" + (costPerFlame == null ? ' flame-count-only' : '')}>
      {(costPerFlame == null ? ['count'] : ['count', 'cost']).map(metric => <div className="flame-confidence max-w-127.5 my-0 mx-auto [&_h4]:text-center [&_h4]:text-[15px] [&_h4]:font-medium [&_h4]:mt-0
        [&_h4]:mx-0 [&_h4]:mb-2 [&_h4]:leading-[1.5]" key={metric}>
        <h4 id={flameType + '-' + metric + '-heading'}>{metric === 'count'
          ? 'Flames needed for an X% chance of a better result'
          : 'Meso cost for an X% chance of a better result'}</h4>
        <div className="flame-confidence-scroll max-h-82.5 overflow-auto [scrollbar-color:#646258_var(--color-surface)]" role="region" aria-labelledby={flameType + '-' + metric + '-heading'} tabIndex="0">
          <table className="flame-confidence-table border-separate border-spacing-[0] text-[13px] tabular-nums [&_th]:py-2 [&_th]:px-2.5
        [&_th]:text-center [&_th]:border-0 [&_th]:whitespace-nowrap [&_td]:py-2 [&_td]:px-2.5 [&_td]:text-center
        [&_td]:border-0 [&_td]:whitespace-nowrap [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-surface
        [&_thead_th]:z-[1] [&_thead_th]:text-[14px] [&_tbody_tr:nth-child(odd)]:bg-[#302f29]
        [&_tbody_tr:target]:bg-[#3c3a32] [&_tbody_tr:target]:[outline:2px_solid_var(--color-maple)]
        [&_tbody_tr:target]:outline-offset-[-2px] [&_tbody_tr:focus]:bg-[#3c3a32]
        [&_tbody_tr:focus]:[outline:2px_solid_var(--color-maple)] [&_tbody_tr:focus]:outline-offset-[-2px]
        [&_tbody_tr]:scroll-mt-10 [&_tbody_th]:rounded-[7px_0_0_7px] [&_tbody_td:last-child]:rounded-[0_7px_7px_0]
        [@media(max-width:480px)]:[&_th]:py-2 [@media(max-width:480px)]:[&_th]:px-1.5
        [@media(max-width:480px)]:[&_td]:py-2 [@media(max-width:480px)]:[&_td]:px-1.5">
            <thead><tr><th scope="col"><span className="sr-only">Equipment</span></th>
              {FLAME_CONFIDENCES.map(confidence => <th scope="col" key={confidence}>{confidence * 100}%</th>)}
            </tr></thead>
            <tbody>{rows.map(entry => <tr key={entry.slot}
              id={metric === 'count' ? 'flame-upgrade-' + flameType + '-' + entry.slot : undefined} tabIndex="-1">
              <th scope="row" title={entry.name + ' (' + entry.slot + ')'}>
                <ItemIcon item={equipment[entry.slot]} name={entry.name} />
                <span className="sr-only">{entry.name} ({entry.slot})</span>
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
      <p className="hint flame-confidence-note text-[12px] text-muted mb-4.5 text-center mt-3">These are odds of at least one better roll, not guarantees.
        {costPerFlame != null && <> Cost is the number of flames shown multiplied by the fixed price per flame.
          M = million; B = billion; T = trillion mesos.</>}</p>
    </div> : <p className="hint text-[12px] text-muted mb-4.5">No eligible improvements for {label}.</p>}
    {unavailable.length > 0 && <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] text-[#d0cec3] [&_summary]:cursor-pointer [&_li]:mb-2">
      <summary>Unavailable {label} estimates ({unavailable.length})</summary>
      <ul>{unavailable.map(entry => <li key={entry.slot}>{entry.name} ({entry.slot}): {entry.note}</li>)}</ul>
    </details>}
  </section>
}
