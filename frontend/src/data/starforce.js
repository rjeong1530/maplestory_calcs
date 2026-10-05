const LIMITED_SWEETWATER_ITEMS = new Set([
  'Sweetwater Shoes', 'Sweetwater Gloves', 'Sweetwater Cape',
])
const LIMITED_BADGES = new Set(['Ghost Ship Exorcist', 'Sengoku Hakase Badge'])

export function supportsStarForce(item, slot = item?.slot ?? '') {
  const type = slot.split('-')[0]
  const name = item?.name ?? ''
  return !['medal', 'badge'].includes(type)
    && (!['secondary', 'shield'].includes(type) || /^(Astra|Deimos)\b/i.test(name)
      || (type === 'secondary' && / Talisman$/i.test(name)))
}

export function maxStarForceForEquipment(item) {
  const level = item?.config?.equipment_level
  if (!Number.isInteger(level) || level < 0) return 0

  const name = item.name || ''
  if (name.startsWith('Elite Heliseum')) return 3
  if (name.startsWith('Nova ')) return 8
  if (name.includes('Tyrant')) return 15
  if (LIMITED_SWEETWATER_ITEMS.has(name)) return 15
  if (LIMITED_BADGES.has(name)) return 22
  if (level < 95) return 5
  if (level < 108) return 8
  if (level < 118) return 10
  if (level < 128) return 15
  if (level < 138) return 20
  return 30
}
