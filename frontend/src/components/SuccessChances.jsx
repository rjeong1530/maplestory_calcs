import { SUCCESS_CHANCES } from '../data/successChances'

export default function SuccessChances({ selected, onChange }) {
  return (
    <fieldset>
      <legend className="success-chances-heading">Success chance estimates</legend>
      <p className="hint">Choose the chances of reaching your target to estimate attempts.</p>
      <div className="percentiles">
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
