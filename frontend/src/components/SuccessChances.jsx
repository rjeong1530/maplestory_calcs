import { SUCCESS_CHANCES } from '../data/successChances'

export default function SuccessChances({ selected, onChange, estimateLabel = 'attempts' }) {
  return (
    <fieldset>
      <legend className="text-[17px] mt-6 mb-2.5 mx-0">Success chance estimates</legend>
      <p className="hint text-[12px] text-subtle mb-4.5">Choose the chances of reaching your target to estimate {estimateLabel}.</p>
      <div className="percentiles flex flex-wrap gap-3.5 mb-7 [&_label]:flex-row [&_label]:items-center [&_label]:gap-1.5
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
        {SUCCESS_CHANCES.map(chance => (
          <label key={chance}>
            <input type="checkbox" checked={selected.includes(chance)}
              onChange={event => onChange(event.target.checked
                ? [...selected, chance].sort((a, b) => a - b)
                : selected.filter(value => value !== chance))} />
            {chance}%
          </label>
        ))}
      </div>
    </fieldset>
  )
}
