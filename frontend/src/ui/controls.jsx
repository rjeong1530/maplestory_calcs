import { useId, useRef } from 'react'
import { motion } from 'framer-motion'
import { cx, useWorkshopMotion } from './motion'

function Button({ children, variant, className, type = 'button', disabled, ...props }) {
  const { press, transition } = useWorkshopMotion()
  return <motion.button {...props} type={type} disabled={disabled} whileTap={disabled ? undefined : press}
    transition={transition} className={cx('mw-button', `mw-button-${variant}`, className)}>{children}</motion.button>
}
export function PrimaryButton(props) { return <Button {...props} variant="primary" /> }
export function SecondaryButton(props) { return <Button {...props} variant="secondary" /> }
export function DangerButton(props) { return <Button {...props} variant="danger" /> }

function Field({ label, hint, error, id, children }) {
  return <div className="mw-field">
    {label && <label className="mw-label" htmlFor={id}>{label}</label>}{children}
    {hint && <p className="mw-help" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="mw-help mw-field-error" id={`${id}-error`} role="alert">{error}</p>}
  </div>
}
function describedBy(id, hint, error, external) {
  return [external, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

export function InputField({ label, hint, error, id: suppliedId, className, multiline = false, ...props }) {
  const generatedId = useId()
  const id = suppliedId || generatedId
  const Element = multiline ? 'textarea' : 'input'
  return <Field {...{ label, hint, error, id }}><Element {...props} id={id} className={cx('mw-control', className)}
    aria-invalid={error ? true : props['aria-invalid']}
    aria-describedby={describedBy(id, hint, error, props['aria-describedby'])} /></Field>
}

export function SelectField({ label, hint, error, id: suppliedId, className, children, ...props }) {
  const generatedId = useId()
  const id = suppliedId || generatedId
  return <Field {...{ label, hint, error, id }}><select {...props} id={id} className={cx('mw-control', className)}
    aria-invalid={error ? true : props['aria-invalid']}
    aria-describedby={describedBy(id, hint, error, props['aria-describedby'])}>{children}</select></Field>
}

export function Toggle({ label, className, ...props }) {
  return <label className="mw-toggle-label"><input {...props} type="checkbox" role="switch" className={cx('mw-switch', className)} /><span>{label}</span></label>
}

// Controlled string API preserves empty input. Native stepUp/stepDown handle the
// step grid; callers still own parsing, validation, persistence and side effects.
export function NumberStepper({ label, value, onValueChange, min, max, step = 1, disabled, readOnly, hint, error, id: suppliedId, ...props }) {
  const generatedId = useId()
  const id = suppliedId || generatedId
  const input = useRef(null)
  function increment(direction) {
    const control = input.current
    if (!control || control.matches(':disabled') || readOnly || step === 'any') return
    const previous = control.value
    try {
      if (direction > 0) control.stepUp()
      else control.stepDown()
      const next = control.value
      control.value = previous
      if (next !== previous) onValueChange(next)
    } catch { control.value = previous }
  }
  const unavailable = disabled || readOnly || step === 'any'
  return <Field {...{ label, hint, error, id }}><div className="mw-stepper">
    <SecondaryButton aria-label={`Decrease ${label}`} disabled={unavailable || (value !== '' && min != null && Number(value) <= Number(min))} onClick={() => increment(-1)}>−</SecondaryButton>
    <input {...props} ref={input} id={id} className="mw-control" type="number" value={value} min={min} max={max} step={step}
      disabled={disabled} readOnly={readOnly} onChange={event => onValueChange(event.target.value)}
      aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy(id, hint, error, props['aria-describedby'])} />
    <SecondaryButton aria-label={`Increase ${label}`} disabled={unavailable || (value !== '' && max != null && Number(value) >= Number(max))} onClick={() => increment(1)}>+</SecondaryButton>
  </div></Field>
}

export function SegmentedControl({ label, options, value, onChange, disabled = false, className }) {
  const id = useId()
  const { transition, reduced } = useWorkshopMotion()
  return <div className={cx('mw-tabs', className)} role="group" aria-label={label}>
    {options.map(option => <button type="button" className="mw-tab" key={option.value} aria-pressed={value === option.value}
      disabled={disabled || option.disabled} onClick={() => onChange(option.value)}>
      {value === option.value && <motion.span className="mw-tab-active" layoutId={reduced ? undefined : id} transition={transition} />}
      <span className="mw-tab-label">{option.label}</span>
    </button>)}
  </div>
}

// All supplied panels stay mounted. Keyboard activation follows the tab pattern.
export function Tabs({ label, tabs, value, onChange, className }) {
  const id = useId()
  const { transition, reduced } = useWorkshopMotion()
  const buttons = useRef([])
  const activeIndex = tabs.findIndex(tab => tab.value === value && !tab.disabled)
  const focusIndex = activeIndex < 0 ? tabs.findIndex(tab => !tab.disabled) : activeIndex
  function keyDown(event, index) {
    const enabled = tabs.map((tab, i) => !tab.disabled ? i : -1).filter(i => i >= 0)
    if (!enabled.length) return
    const current = enabled.indexOf(index)
    let next
    if (event.key === 'ArrowRight') next = enabled[(current + 1) % enabled.length]
    if (event.key === 'ArrowLeft') next = enabled[(current - 1 + enabled.length) % enabled.length]
    if (event.key === 'Home') next = enabled[0]
    if (event.key === 'End') next = enabled.at(-1)
    if (next == null) return
    event.preventDefault()
    buttons.current[next]?.focus()
    onChange(tabs[next].value)
  }
  return <div className={className}>
    <div className="mw-tabs" role="tablist" aria-label={label}>{tabs.map((tab, index) => <button type="button" role="tab" key={tab.value}
      ref={element => { buttons.current[index] = element }} id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
      aria-selected={value === tab.value} tabIndex={index === focusIndex ? 0 : -1} disabled={tab.disabled} className="mw-tab"
      onClick={() => onChange(tab.value)} onKeyDown={event => keyDown(event, index)}>
      {value === tab.value && <motion.span className="mw-tab-active" layoutId={reduced ? undefined : id} transition={transition} />}
      <span className="mw-tab-label">{tab.label}</span>
    </button>)}</div>
    {tabs.map((tab, index) => <div key={tab.value} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`}
      tabIndex={0} hidden={value !== tab.value} className="pt-5">{tab.content}</div>)}
  </div>
}
