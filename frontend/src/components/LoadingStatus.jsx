import { LoadingPlaceholder } from '../ui/loading'

export default function LoadingStatus({ children = 'Loading calculator tools…', variant = 'card', service = true }) {
  return <LoadingPlaceholder label={children} variant={variant} service={service} />
}
