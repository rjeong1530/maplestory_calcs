// Checks the shared solid-color text pairs, not text over arbitrary artwork.
export function contrastPairs() {
  const host = document.querySelector('.mw-theme')
  const probe = document.createElement('span')
  probe.hidden = true
  host.append(probe)
  const rgb = token => {
    probe.style.color = `var(${token})`
    return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0,3).map(Number)
  }
  const luminance = channels => {
    const linear = channels.map(c => {const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4})
    return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722
  }
  const pairs = [
    ['--text-primary','--surface-secondary'],['--text-secondary','--surface-secondary'],
    ['--primary-ink','--surface-hover'],['--danger-ink','--danger-bg'],
    ['--button-text','--button-fill'],['--tooltip-text','--tooltip-bg'],
    ...['rare','epic','unique','legendary'].map(r=>[`--rarity-${r}`,`--rarity-${r}-bg`]),
  ].map(([foreground,background])=>{
    const a=luminance(rgb(foreground)),b=luminance(rgb(background))
    return {foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
  })
  probe.remove()
  return pairs
}
