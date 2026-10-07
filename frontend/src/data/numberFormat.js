const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const precise = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

export const count = value => integer.format(value)
export function mesoBreakdown(value) {
  if (value == null || String(value).trim() === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return ''
  let remaining = BigInt(Math.round(amount))
  const parts = []
  for (const [unit, suffix] of [[1000000000000n, 'T'], [1000000000n, 'B'], [1000000n, 'M'], [1000n, 'K']]) {
    const quantity = remaining / unit
    if (quantity) parts.push(`${quantity}${suffix}`)
    remaining %= unit
  }
  if (remaining || !parts.length) parts.push(String(remaining))
  return parts.join(' ')
}
export const percentage = value => value > 0 && value < 0.000001
  ? value.toExponential(3) : precise.format(value)
