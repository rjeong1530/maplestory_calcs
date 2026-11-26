export default function PageBackground({ backgroundImage = '/images/workshop/floating-islands.webp' }) {
  if (!backgroundImage) return null
  return <div className="mw-background" aria-hidden="true" style={{ '--workshop-background': `url("${backgroundImage}")` }}>
    <div className="mw-background-day" />
    <div className="mw-background-night" />
  </div>
}
