import { useEffect, useMemo, useState } from 'react'

const GITHUB_USER = 'BokEumEom'
const SITE_PAGE_SIZE = 18
const VIEWS = ['home', 'sites', 'prompts', 'ideas']
const SOURCE_LABEL = { github: 'GitHub', vercel: 'Vercel', cloudflare: 'Cloudflare', chatgpt: 'ChatGPT Site', manual: 'Notes' }
const CATEGORY_LABEL = { image: 'Image', video: 'Video', web: 'Web', '3d': '3D', game: 'Game', research: 'Research' }

function inferTags(repo) {
  const text = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase()
  const rules = [
    ['ai', ['ai', 'llm', 'agent', 'rag', 'gemini']],
    ['devops', ['devops', 'terraform', 'kubernetes', 'aws', 'infra', 'sre']],
    ['game', ['game', 'quiz', 'puzzle', 'rpg', 'reversi', 'arcade']],
    ['data', ['data', 'trend', 'dashboard', 'scrape']],
    ['web', ['web', 'react', 'next', 'svelte', 'gatsby']],
    ['ev', ['ev', 'charging', 'electric']],
    ['bible', ['bible', 'catechism', 'proverbs']],
  ]
  const tags = rules.filter(([, words]) => words.some((word) => text.includes(word))).map(([tag]) => tag)
  if (repo.language) tags.push(repo.language.toLowerCase())
  return [...new Set(tags)].slice(0, 5)
}

function repoToItem(repo) {
  return {
    id: `gh-${repo.id}`,
    type: 'project',
    title: repo.name,
    summary: repo.description || 'GitHub에 기록된 프로젝트',
    date: (repo.created_at || '').slice(0, 10),
    updated: (repo.updated_at || '').slice(0, 10),
    status: repo.archived ? 'archived' : 'repository',
    featured: false,
    sources: ['github'],
    tags: inferTags(repo),
    githubRepo: repo.full_name,
    liveUrl: repo.homepage || '',
    preview: '',
    idea: '',
    prompt: '',
    notes: repo.language ? `Primary language: ${repo.language}` : '',
  }
}

async function loadArchive() {
  const response = await fetch('/data/archive.json')
  if (!response.ok) throw new Error('archive.json을 불러오지 못했습니다.')
  return response.json()
}

async function loadGithub() {
  const response = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status}`)
  return (await response.json()).filter((repo) => !repo.fork).map(repoToItem)
}

function mergeItems(localItems, githubItems) {
  const manualRepos = new Set(localItems.map((item) => item.githubRepo?.toLowerCase()).filter(Boolean))
  return [...localItems, ...githubItems.filter((item) => !manualRepos.has(item.githubRepo?.toLowerCase()))]
}

function formatDate(value) {
  if (!value) return '날짜 없음'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function screenshotUrl(item) {
  if (item.preview) return item.preview
  if (!item.liveUrl) return ''
  return `https://image.thum.io/get/width/1200/crop/760/noanimate/${item.liveUrl}`
}

function Header({ view, onNavigate, theme, onTheme }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate('home')} aria-label="BokEum Archive 홈">
        <span className="brand-mark">B</span>
        <span><strong>BokEum</strong><small>Archive</small></span>
      </button>
      <nav className="main-nav" aria-label="주요 메뉴">
        {[
          ['home', 'Home'], ['sites', 'Sites'], ['prompts', 'Prompt Gallery'], ['ideas', 'Ideas'],
        ].map(([key, label]) => (
          <button key={key} className={`nav-link ${view === key ? 'active' : ''}`} onClick={() => onNavigate(key)}>{label}</button>
        ))}
      </nav>
      <div className="header-actions">
        <a className="github-link" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">GitHub ↗</a>
        <button className="icon-button" onClick={onTheme} aria-label="테마 변경">{theme === 'dark' ? '☼' : '◐'}</button>
      </div>
    </header>
  )
}

function SiteCard({ item, onOpen, featured = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  const preview = screenshotUrl(item)
  return (
    <article className={`site-card ${featured ? 'featured' : ''}`} onClick={() => onOpen(item)}>
      <div className="site-preview">
        {preview && !imageFailed ? (
          <img src={preview} alt={`${item.title} 미리보기`} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="site-fallback"><span>{hostOf(item.liveUrl) || item.title}</span><strong>{item.title.slice(0, 2).toUpperCase()}</strong></div>
        )}
        <div className="preview-overlay">
          <span>{(item.sources || []).map((source) => SOURCE_LABEL[source] || source).join(' · ')}</span>
          <span>{item.status}</span>
        </div>
      </div>
      <div className="site-copy">
        <div><h3>{item.title}</h3><p>{item.summary}</p></div>
        <div className="site-meta"><span>{formatDate(item.updated || item.date)}</span><span>{(item.tags || []).slice(0, 3).map((tag) => `#${tag}`).join(' ')}</span></div>
      </div>
    </article>
  )
}

function PromptVisual({ item }) {
  const [failed, setFailed] = useState(false)
  if (item.preview && !failed) return <img src={item.preview} alt={`${item.title} 생성 결과`} loading="lazy" onError={() => setFailed(true)} />
  return (
    <div className={`prompt-placeholder category-${item.category || 'other'}`}>
      <span>{CATEGORY_LABEL[item.category] || 'Prompt'}</span>
      <strong>{item.title}</strong>
      <small>Preview image pending</small>
    </div>
  )
}

function PromptCard({ item, onOpen }) {
  const [copied, setCopied] = useState(false)
  const copy = async (event) => {
    event.stopPropagation()
    await navigator.clipboard.writeText(item.prompt || '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <article className="prompt-card" onClick={() => onOpen(item)}>
      <div className="prompt-visual"><PromptVisual item={item} /><span className="model-badge">{item.model || 'Prompt'}</span></div>
      <div className="prompt-card-copy">
        <div className="prompt-heading"><span>{CATEGORY_LABEL[item.category] || item.category || 'Prompt'}</span><span>{formatDate(item.updated || item.date)}</span></div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <button className="copy-button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy Prompt'}</button>
      </div>
    </article>
  )
}

function DetailModal({ item, onClose }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!item) return null
  const copy = async () => {
    await navigator.clipboard.writeText(item.prompt || '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="detail-modal" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="modal-close" onClick={onClose}>×</button>
        {item.type === 'prompt' && <div className="modal-preview"><PromptVisual item={item} /></div>}
        <p className="eyebrow">{item.type === 'prompt' ? `${CATEGORY_LABEL[item.category] || 'PROMPT'} · ${item.model || ''}` : (item.sources || []).map((s) => SOURCE_LABEL[s] || s).join(' · ')}</p>
        <h2>{item.title}</h2>
        <p className="modal-summary">{item.summary}</p>
        <div className="tag-list">{(item.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className="modal-links">
          {item.liveUrl && <a href={item.liveUrl} target="_blank" rel="noreferrer">Live site ↗</a>}
          {item.githubRepo && <a href={`https://github.com/${item.githubRepo}`} target="_blank" rel="noreferrer">GitHub ↗</a>}
        </div>
        {item.idea && <div className="detail-block"><h3>Idea</h3><p>{item.idea}</p></div>}
        {item.prompt && <div className="detail-block"><div className="block-title"><h3>Prompt</h3><button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div><pre>{item.prompt}</pre></div>}
        {item.notes && <div className="detail-block"><h3>Notes</h3><p>{item.notes}</p></div>}
      </section>
    </div>
  )
}

function Home({ items, githubCount, onNavigate, onOpen }) {
  const sites = items.filter((item) => item.type === 'project')
  const prompts = items.filter((item) => item.type === 'prompt')
  const ideas = items.filter((item) => item.type === 'idea' || item.type === 'experiment')
  const selectedSites = sites.filter((item) => item.featured).slice(0, 6)
  const selectedPrompts = prompts.filter((item) => item.featured).slice(0, 6)
  return (
    <>
      <section className="hero shell">
        <p className="eyebrow">PERSONAL BUILD MEMORY</p>
        <h1>Things I’ve built,<br /><span>prompted & explored.</span></h1>
        <p className="hero-copy">GitHub, Vercel, Cloudflare, ChatGPT Site에 흩어진 결과물과 그때 사용한 프롬프트·아이디어를 한곳에 모읍니다.</p>
        <div className="hero-actions"><button className="primary-btn" onClick={() => onNavigate('sites')}>사이트 둘러보기</button><button className="ghost-btn" onClick={() => onNavigate('prompts')}>Prompt Gallery</button></div>
        <div className="stats-row">
          <button onClick={() => onNavigate('sites')}><strong>{sites.length}</strong><span>Sites & Projects</span></button>
          <button onClick={() => onNavigate('prompts')}><strong>{prompts.length}</strong><span>Prompts</span></button>
          <button onClick={() => onNavigate('ideas')}><strong>{ideas.length}</strong><span>Ideas & Experiments</span></button>
          <div><strong>{githubCount}</strong><span>GitHub synced</span></div>
        </div>
      </section>
      <section className="shell home-section">
        <SectionHeading eyebrow="SELECTED WORK" title="Sites" action="전체 보기 →" onAction={() => onNavigate('sites')} />
        <div className="site-grid featured-site-grid">{selectedSites.map((item) => <SiteCard key={item.id} item={item} featured onOpen={onOpen} />)}</div>
      </section>
      <section className="home-prompt-band"><div className="shell">
        <SectionHeading eyebrow="REMIX & REUSE" title="Prompt Gallery" description="결과 이미지와 함께 다시 꺼내 쓰는 프롬프트 모음." action="갤러리 열기 →" onAction={() => onNavigate('prompts')} />
        <div className="prompt-masonry compact">{selectedPrompts.map((item) => <PromptCard key={item.id} item={item} onOpen={onOpen} />)}</div>
      </div></section>
    </>
  )
}

function SectionHeading({ eyebrow, title, description, action, onAction }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <button className="text-link" onClick={onAction}>{action}</button>}</div>
}

function Sites({ items, onOpen }) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [sort, setSort] = useState('recent')
  const [shown, setShown] = useState(SITE_PAGE_SIZE)
  const projects = useMemo(() => items.filter((item) => item.type === 'project').filter((item) => {
    if (source !== 'all' && !(item.sources || []).includes(source)) return false
    const hay = `${item.title} ${item.summary} ${(item.tags || []).join(' ')} ${(item.sources || []).join(' ')}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  }).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'oldest' ? (a.updated || a.date || '').localeCompare(b.updated || b.date || '') : (b.updated || b.date || '').localeCompare(a.updated || a.date || '')), [items, query, source, sort])
  useEffect(() => setShown(SITE_PAGE_SIZE), [query, source, sort])
  return <section className="shell page-view">
    <div className="page-hero"><p className="eyebrow">WEB / APP / GAME / EXPERIMENT</p><h1>Sites</h1><p>실제로 만든 사이트와 프로젝트를 결과 화면 중심으로 봅니다. Live가 있으면 사이트 스크린샷을 우선 표시합니다.</p></div>
    <div className="toolbar sticky-toolbar"><div className="search-wrap"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="사이트, 기술, 아이디어 검색…" /></div><div className="chip-row">{['all', 'vercel', 'cloudflare', 'chatgpt', 'github'].map((key) => <button key={key} className={`chip ${source === key ? 'active' : ''}`} onClick={() => setSource(key)}>{key === 'all' ? 'All' : SOURCE_LABEL[key]}</button>)}</div></div>
    <div className="result-line"><span>{projects.length}개</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">최근 업데이트</option><option value="name">이름순</option><option value="oldest">오래된 순</option></select></div>
    <div className="site-grid">{projects.slice(0, shown).map((item) => <SiteCard key={item.id} item={item} onOpen={onOpen} />)}</div>
    {shown < projects.length && <button className="load-more" onClick={() => setShown((value) => value + SITE_PAGE_SIZE)}>더 보기</button>}
  </section>
}

function Prompts({ items, onOpen }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const prompts = useMemo(() => items.filter((item) => item.type === 'prompt').filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    const hay = `${item.title} ${item.summary} ${item.prompt} ${item.model || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  }).sort((a, b) => (b.updated || b.date || '').localeCompare(a.updated || a.date || '')), [items, query, category])
  return <section className="shell page-view">
    <div className="page-hero prompt-page-hero"><p className="eyebrow">IMAGE / VIDEO / WEB / 3D / GAME</p><h1>Prompt Gallery</h1><p>프롬프트 텍스트보다 <strong>무엇이 나왔는지</strong> 먼저 봅니다. 이미지를 눌러 전체 프롬프트를 열고 바로 복사할 수 있습니다.</p></div>
    <div className="toolbar sticky-toolbar"><div className="search-wrap"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="image, video, 3D, game, website…" /></div><div className="chip-row">{['all', 'image', 'video', 'web', '3d', 'game', 'research'].map((key) => <button key={key} className={`chip ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>{key === 'all' ? 'All' : CATEGORY_LABEL[key]}</button>)}</div></div>
    <div className="result-line"><span>{prompts.length}개 프롬프트</span><span className="hint">이미지는 <code>public/assets/prompts</code>에 저장 후 preview 연결</span></div>
    <div className="prompt-masonry">{prompts.map((item) => <PromptCard key={item.id} item={item} onOpen={onOpen} />)}</div>
  </section>
}

function Ideas({ items, onOpen }) {
  const ideas = items.filter((item) => item.type === 'idea' || item.type === 'experiment').sort((a, b) => (b.updated || b.date || '').localeCompare(a.updated || a.date || ''))
  return <section className="shell page-view"><div className="page-hero"><p className="eyebrow">BACKLOG / THINKING / LEARNING</p><h1>Ideas & Experiments</h1><p>완성된 결과물 전 단계의 생각, 실험, 다음에 해볼 것들을 시간순으로 남깁니다.</p></div><div className="idea-grid">{ideas.map((item) => <button key={item.id} className="idea-card" onClick={() => onOpen(item)}><span>{formatDate(item.updated || item.date)}</span><h3>{item.title}</h3><p>{item.summary}</p><div>{(item.tags || []).slice(0, 4).map((tag) => <em key={tag}>#{tag}</em>)}</div></button>)}</div></section>
}

export default function App() {
  const [view, setView] = useState(() => VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home')
  const [items, setItems] = useState([])
  const [githubCount, setGithubCount] = useState(0)
  const [updated, setUpdated] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('archive-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('archive-theme', theme)
  }, [theme])

  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1)
      if (VIEWS.includes(next)) setView(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([loadArchive(), loadGithub().catch(() => [])]).then(([archive, github]) => {
      if (!active) return
      setGithubCount(github.length)
      setUpdated(archive.updated || '')
      setItems(mergeItems(archive.items || [], github))
    }).catch((err) => active && setError(err.message))
    return () => { active = false }
  }, [])

  const navigate = (next) => {
    setView(next)
    history.pushState(null, '', `#${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <>
    <Header view={view} onNavigate={navigate} theme={theme} onTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />
    <main>
      {error && <div className="error-banner">{error}</div>}
      {view === 'home' && <Home items={items} githubCount={githubCount} onNavigate={navigate} onOpen={setSelected} />}
      {view === 'sites' && <Sites items={items} onOpen={setSelected} />}
      {view === 'prompts' && <Prompts items={items} onOpen={setSelected} />}
      {view === 'ideas' && <Ideas items={items} onOpen={setSelected} />}
    </main>
    <footer className="site-footer shell"><span>© {new Date().getFullYear()} BokEum Archive</span><span>{updated ? `${formatDate(updated)} · GitHub ${githubCount} repos synced` : 'loading archive…'}</span></footer>
    {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
  </>
}
