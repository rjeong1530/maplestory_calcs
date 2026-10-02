export const FLAME_CONFIDENCES = [0.25, 0.5, 0.75, 0.99]

export function flamesForConfidence(probability, confidence) {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) return null
  if (probability === 1) return 1
  return Math.ceil(Math.log1p(-confidence) / Math.log1p(-probability))
}

export function formatFlameChance(probability) {
  const percent = probability * 100
  return `${percent > 0 && percent < 0.001
    ? percent.toPrecision(2)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(percent)}%`
}

export function costForConfidence(probability, confidence, costPerFlame) {
  const flames = flamesForConfidence(probability, confidence)
  return flames == null || !Number.isFinite(costPerFlame) || costPerFlame < 0
    ? null : flames * costPerFlame
}
