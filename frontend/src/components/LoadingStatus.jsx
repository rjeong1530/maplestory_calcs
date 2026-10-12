export default function LoadingStatus({ children = 'Loading calculator tools…' }) {
  return <div role="status">
    <p>{children}</p>
    <p className="hint">The calculator uses a free backend that may need to wake up after inactivity.
      The first request can take longer during this cold start. Please keep this page open while it loads.</p>
  </div>
}
