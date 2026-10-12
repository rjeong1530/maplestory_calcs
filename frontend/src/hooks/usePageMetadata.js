import { useEffect } from 'react'
import { pageMetadata } from '../data/pageContent.js'

export default function usePageMetadata(page) {
  useEffect(() => {
    const { title, description, canonical } = pageMetadata(page)
    document.title = title
    function meta(attribute, key, content) {
      let node = document.head.querySelector(`meta[${attribute}="${key}"]`)
      if (!node) {
        node = document.createElement('meta')
        node.setAttribute(attribute, key)
        document.head.append(node)
      }
      node.content = content
    }
    meta('name', 'description', description)
    meta('property', 'og:title', title)
    meta('property', 'og:description', description)
    meta('name', 'robots', canonical ? 'index,follow' : 'noindex,follow')
    let link = document.head.querySelector('link[rel="canonical"]')
    if (canonical) {
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.append(link)
      }
      link.href = canonical
      meta('property', 'og:url', canonical)
    } else {
      link?.remove()
      document.head.querySelector('meta[property="og:url"]')?.remove()
    }
  }, [page])
}
