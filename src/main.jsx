import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const nativeFetch = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || ''
  if (!url.endsWith('/data/archive.json')) return nativeFetch(input, init)

  const archiveResponse = await nativeFetch(input, init)
  if (!archiveResponse.ok) return archiveResponse

  try {
    const archive = await archiveResponse.clone().json()
    const [sitesResponse, galleryResponse, overridesResponse] = await Promise.all([
      nativeFetch('/data/chatgpt-sites.json', { cache: 'no-store' }),
      nativeFetch('/data/gallery.json', { cache: 'no-store' }),
      nativeFetch('/data/project-overrides.json', { cache: 'no-store' }),
    ])
    const sites = sitesResponse.ok ? await sitesResponse.json() : { items: [] }
    const gallery = galleryResponse.ok ? await galleryResponse.json() : { items: [] }
    const overrides = overridesResponse.ok ? await overridesResponse.json() : { items: [] }
    const overrideRepos = new Set((overrides.items || []).map((item) => item.githubRepo?.toLowerCase()).filter(Boolean))

    const baseItems = (archive.items || []).filter((item) => {
      const isLegacyPrompt = item.type === 'prompt'
      const isChatgptSiteProject = item.type === 'project' && (item.sources || []).includes('chatgpt')
      const isOverriddenProject = item.githubRepo && overrideRepos.has(item.githubRepo.toLowerCase())
      return !isLegacyPrompt && !isChatgptSiteProject && !isOverriddenProject
    })

    return new Response(JSON.stringify({
      ...archive,
      updated: overrides.updated || gallery.updated || sites.updated || archive.updated,
      items: [...baseItems, ...(overrides.items || []), ...(sites.items || []), ...(gallery.items || [])],
    }), {
      status: archiveResponse.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return archiveResponse
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
