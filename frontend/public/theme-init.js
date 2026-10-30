// Run before styles/React to avoid displaying the daytime theme on a dark system.
window.__workshopThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
document.documentElement.classList.toggle('dark', window.__workshopThemeMedia.matches)
