import { useState } from 'react'

export default function EquipmentIcon({ item }) {
  const [failedUrls, setFailedUrls] = useState([])
  const url = item?.icon && !failedUrls.includes(item.icon) ? item.icon : null
  return url && (
    <img src={url} alt="" width="38" height="38" loading="lazy" decoding="async"
      onError={() => setFailedUrls(current => [...current, url])} />
  )
}
