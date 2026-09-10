import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const nativeFetch = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || ''

  if (!url.endsWith('/data/archive.json')) {
    return nativeFetch(input, init)
  }

  const archiveResponse = await nativeFetch(input, init)
  if (!archiveResponse.ok) return archiveResponse

  try {
    const archive = await archiveResponse.clone().json()
    const [sitesResponse, galleryResponse] = await Promise.all([
      nativeFetch('/data/chatgpt-sites.json'),
      nativeFetch('/data/gallery.json'),
    ])

    const sites = sitesResponse.ok ? await sitesResponse.json() : { items: [] }
    const gallery = galleryResponse.ok ? await galleryResponse.json() : { items: [] }
    const galleryIds = new Set((gallery.items || []).map((item) => item.id))

    const baseItems = (archive.items || []).filter((item) => {
      const isChatgptSiteProject = item.type === 'project' && (item.sources || []).includes('chatgpt')
      const replacedByGallery = galleryIds.has(item.id)
      return !isChatgptSiteProject && !replacedByGallery
    })

    return new Response(
      JSON.stringify({
        ...archive,
        updated: gallery.updated || sites.updated || archive.updated,
        items: [...baseItems, ...(sites.items || []), ...(gallery.items || [])],
      }),
      {
        status: archiveResponse.status,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch {
    return archiveResponse
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
