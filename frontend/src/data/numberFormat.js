const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const precise = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

export const count = value => integer.format(value)
export const percentage = value => value > 0 && value < 0.000001
  ? value.toExponential(3) : precise.format(value)
