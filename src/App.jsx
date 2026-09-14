import { useEffect, useMemo, useState } from 'react'

const GITHUB_USER = 'BokEumEom'
const SITE_PAGE_SIZE = 18
const VIEWS = ['home', 'sites', 'games', 'prompts', 'ideas', 'admin']
const SOURCE_LABEL = { github: 'GitHub', vercel: 'Vercel', cloudflare: 'Cloudflare', chatgpt: 'ChatGPT Site', manual: 'Notes' }
const CATEGORY_LABEL = { image: 'Image', video: 'Video', web: 'Web', '3d': '3D', game: 'Game', research: 'Research' }
const GAME_HINTS = ['game', 'games', 'rpg', 'runner', 'arcade', 'reversi', 'quiz', 'puzzle', 'roguelike', 'platformer']
const GAME_TITLES = ['rift rush', 'gearsprout', 'moonberry rush']

function inferTags(repo) {
  const text = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase()
  const rules = [
    ['ai', ['ai', 'llm', 'agent', 'rag', 'gemini']],
    ['devops', ['devops', 'terraform', 'kubernetes', 'aws', 'infra', 'sre']],
    ['game', ['game', 'quiz', 'puzzle', 'rpg', 'reversi', 'arcade', 'runner', 'roguelike']],
    ['data', ['data', 'trend', 'dashboard', 'scrape']],
    ['web', ['web', 'react', 'next', 'svelte', 'gatsby']],
    ['ev', ['ev', 'charging', 'electric']],
    ['bible', ['bible', 'catechism', 'proverbs']],
  ]
  const tags = rules.filter(([, words]) => words.some((word) => text.includes(word))).map(([tag]) => tag)
  if (repo.language) tags.push(repo.language.toLowerCase())
  return [...new Set(tags)].slice(0, 6)
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

function isGameProject(item) {
  if (item.type !== 'project') return false
  const title = (item.title || '').toLowerCase()
  if (GAME_TITLES.some((name) => title.includes(name))) return true
  const tags = (item.tags || []).map((tag) => String(tag).toLowerCase())
  return tags.some((tag) => GAME_HINTS.some((hint) => tag === hint || tag.includes(hint)))
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
  const nav = [['home', 'Home'], ['sites', 'Sites'], ['games', 'Games'], ['prompts', 'Prompt Gallery'], ['ideas', 'Ideas']]
  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate('home')} aria-label="BokEum Archive 홈">
        <span className="brand-mark">B</span>
        <span><strong>BokEum</strong><small>Archive</small></span>
      </button>
      <nav className="main-nav" aria-label="주요 메뉴">
        {nav.map(([key, label]) => <button key={key} className={`nav-link ${view === key ? 'active' : ''}`} onClick={() => onNavigate(key)}>{label}</button>)}
      </nav>
      <div className="header-actions">
        <a className="github-link" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">GitHub ↗</a>
        <button className="icon-button" onClick={onTheme} aria-label="테마 변경">{theme === 'dark' ? '☼' : '◐'}</button>
      </div>
    </header>
  )
}

function MobileNav({ view, onNavigate }) {
  return <nav className="mobile-nav" aria-label="모바일 메뉴">
    {[['home', 'Home'], ['sites', 'Sites'], ['games', 'Games'], ['prompts', 'Prompts']].map(([key, label]) => (
      <button key={key} className={view === key ? 'active' : ''} onClick={() => onNavigate(key)}>{label}</button>
    ))}
  </nav>
}

function SiteCard({ item, onOpen, featured = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  const preview = screenshotUrl(item)
  return (
    <article className={`site-card ${featured ? 'featured' : ''}`} onClick={() => onOpen(item)}>
      <div className="site-preview">
        {preview && !imageFailed ? <img src={preview} alt={`${item.title} 미리보기`} loading="lazy" onError={() => setImageFailed(true)} /> : (
          <div className="site-fallback"><span>{hostOf(item.liveUrl) || item.title}</span><strong>{item.title.slice(0, 2).toUpperCase()}</strong></div>
        )}
        <div className="preview-overlay"><span>{(item.sources || []).map((source) => SOURCE_LABEL[source] || source).join(' · ')}</span><span>{item.status}</span></div>
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
  return <div className={`prompt-placeholder category-${item.category || 'other'}`}><span>{CATEGORY_LABEL[item.category] || 'Prompt'}</span><strong>{item.title}</strong><small>Image unavailable</small></div>
}

function PromptCard({ item, onOpen }) {
  const [copied, setCopied] = useState(false)
  const copy = async (event) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(item.prompt || '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { setCopied(false) }
  }
  return (
    <article className="prompt-card" onClick={() => onOpen(item)}>
      <div className="prompt-visual"><PromptVisual item={item} /><span className="model-badge">{item.model || 'Prompt'}</span></div>
      <div className="prompt-card-copy"><div className="prompt-heading"><span>{CATEGORY_LABEL[item.category] || item.category || 'Prompt'}</span></div><h3>{item.title}</h3><button className="copy-button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy Prompt'}</button></div>
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
    try {
      await navigator.clipboard.writeText(item.prompt || '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { setCopied(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="detail-modal" role="dialog" aria-modal="true" aria-label={item.title}>
      <button className="modal-close" onClick={onClose}>×</button>
      {item.type === 'prompt' && <div className="modal-preview"><PromptVisual item={item} /></div>}
      <p className="eyebrow">{item.type === 'prompt' ? `${CATEGORY_LABEL[item.category] || 'PROMPT'} · ${item.model || ''}` : (item.sources || []).map((s) => SOURCE_LABEL[s] || s).join(' · ')}</p>
      <h2>{item.title}</h2><p className="modal-summary">{item.summary}</p>
      <div className="tag-list">{(item.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <div className="modal-links">{item.liveUrl && <a href={item.liveUrl} target="_blank" rel="noreferrer">Live site ↗</a>}{item.githubRepo && <a href={`https://github.com/${item.githubRepo}`} target="_blank" rel="noreferrer">GitHub ↗</a>}</div>
      {item.idea && <div className="detail-block"><h3>Idea</h3><p>{item.idea}</p></div>}
      {item.prompt && <div className="detail-block"><div className="block-title"><h3>Prompt</h3><button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div><pre>{item.prompt}</pre></div>}
      {item.notes && <div className="detail-block"><h3>Notes</h3><p>{item.notes}</p></div>}
    </section>
  </div>
}

function SectionHeading({ eyebrow, title, description, action, onAction }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <button className="text-link" onClick={onAction}>{action}</button>}</div>
}

function Home({ items, githubCount, onNavigate, onOpen }) {
  const projects = items.filter((item) => item.type === 'project')
  const games = projects.filter(isGameProject)
  const sites = projects.filter((item) => !isGameProject(item))
  const prompts = items.filter((item) => item.type === 'prompt')
  const selectedSites = sites.filter((item) => item.featured).slice(0, 6)
  const selectedGames = games.filter((item) => item.featured).slice(0, 3)
  const selectedPrompts = prompts.slice(0, 6)
  return <>
    <section className="hero shell">
      <p className="eyebrow">PERSONAL BUILD MEMORY</p>
      <h1>Things I’ve built,<br /><span>prompted & explored.</span></h1>
      <p className="hero-copy">사이트, 게임, 프롬프트와 아이디어를 결과물 중심으로 한곳에 모읍니다.</p>
      <div className="hero-actions"><button className="primary-btn" onClick={() => onNavigate('sites')}>사이트 둘러보기</button><button className="ghost-btn" onClick={() => onNavigate('prompts')}>Prompt Gallery</button></div>
      <div className="stats-row">
        <button onClick={() => onNavigate('sites')}><strong>{sites.length}</strong><span>Sites</span></button>
        <button onClick={() => onNavigate('games')}><strong>{games.length}</strong><span>Games</span></button>
        <button onClick={() => onNavigate('prompts')}><strong>{prompts.length}</strong><span>Prompts</span></button>
        <div><strong>{githubCount}</strong><span>GitHub synced</span></div>
      </div>
    </section>
    <section className="shell home-section"><SectionHeading eyebrow="SELECTED WORK" title="Sites" action="전체 보기 →" onAction={() => onNavigate('sites')} /><div className="site-grid featured-site-grid">{selectedSites.map((item) => <SiteCard key={item.id} item={item} featured onOpen={onOpen} />)}</div></section>
    {selectedGames.length > 0 && <section className="shell home-section"><SectionHeading eyebrow="PLAYABLE BUILDS" title="Games" action="게임 보기 →" onAction={() => onNavigate('games')} /><div className="site-grid">{selectedGames.map((item) => <SiteCard key={item.id} item={item} onOpen={onOpen} />)}</div></section>}
    <section className="home-prompt-band"><div className="shell"><SectionHeading eyebrow="REMIX & REUSE" title="Prompt Gallery" description="직접 고른 이미지와 실제 사용한 프롬프트만 등록합니다." action="갤러리 열기 →" onAction={() => onNavigate('prompts')} />{selectedPrompts.length ? <div className="prompt-masonry compact">{selectedPrompts.map((item) => <PromptCard key={item.id} item={item} onOpen={onOpen} />)}</div> : <EmptyGallery onAdmin={() => onNavigate('admin')} />}</div></section>
  </>
}

function ProjectBrowser({ items, onOpen, gameMode = false }) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [sort, setSort] = useState('recent')
  const [shown, setShown] = useState(SITE_PAGE_SIZE)
  const projects = useMemo(() => items.filter((item) => item.type === 'project' && (gameMode ? isGameProject(item) : !isGameProject(item))).filter((item) => {
    if (source !== 'all' && !(item.sources || []).includes(source)) return false
    const hay = `${item.title} ${item.summary} ${(item.tags || []).join(' ')} ${(item.sources || []).join(' ')}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  }).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'oldest' ? (a.updated || a.date || '').localeCompare(b.updated || b.date || '') : (b.updated || b.date || '').localeCompare(a.updated || a.date || '')), [items, query, source, sort, gameMode])
  useEffect(() => setShown(SITE_PAGE_SIZE), [query, source, sort])
  return <section className="shell page-view">
    <div className="page-hero"><p className="eyebrow">{gameMode ? 'PLAYABLE / PROTOTYPE / EXPERIMENT' : 'WEB / APP / TOOL / EXPERIMENT'}</p><h1>{gameMode ? 'Games' : 'Sites'}</h1><p>{gameMode ? '러너, RPG, 퍼즐, 보드게임 등 플레이 가능한 실험을 일반 사이트와 분리해서 봅니다.' : '게임을 제외한 웹사이트, 앱, 대시보드와 도구를 결과 화면 중심으로 봅니다.'}</p></div>
    <div className="toolbar sticky-toolbar"><div className="search-wrap"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder={gameMode ? '게임 검색…' : '사이트, 기술, 아이디어 검색…'} /></div><div className="chip-row">{['all', 'vercel', 'cloudflare', 'chatgpt', 'github'].map((key) => <button key={key} className={`chip ${source === key ? 'active' : ''}`} onClick={() => setSource(key)}>{key === 'all' ? 'All' : SOURCE_LABEL[key]}</button>)}</div></div>
    <div className="result-line"><span>{projects.length}개</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">최근 업데이트</option><option value="name">이름순</option><option value="oldest">오래된 순</option></select></div>
    <div className="site-grid">{projects.slice(0, shown).map((item) => <SiteCard key={item.id} item={item} onOpen={onOpen} />)}</div>{shown < projects.length && <button className="load-more" onClick={() => setShown((value) => value + SITE_PAGE_SIZE)}>더 보기</button>}
  </section>
}

function EmptyGallery({ onAdmin }) {
  return <div className="empty-gallery"><span>0 PROMPTS</span><h3>좋은 결과물만 직접 등록하세요.</h3><p>이미지와 실제 프롬프트를 한 쌍으로 올리면 이곳에 바로 카드가 만들어집니다.</p><button className="primary-btn" onClick={onAdmin}>+ Add Prompt</button></div>
}

function Prompts({ items, onOpen, onAdmin }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const prompts = useMemo(() => items.filter((item) => item.type === 'prompt').filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    const hay = `${item.title} ${item.summary} ${item.prompt} ${item.model || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  }).sort((a, b) => (b.updated || b.date || '').localeCompare(a.updated || a.date || '')), [items, query, category])
  return <section className="shell page-view prompt-gallery-view">
    <div className="page-hero prompt-page-hero"><p className="eyebrow">CURATED OUTPUTS / REUSABLE RECIPES</p><h1>Prompt Gallery</h1><p>자동 수집하지 않습니다. 직접 고른 원본 이미지와 실제 사용한 프롬프트만 보관합니다.</p><button className="add-prompt-link" onClick={onAdmin}>+ Add Prompt</button></div>
    {prompts.length > 0 ? <><div className="toolbar sticky-toolbar"><div className="search-wrap"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="image, video, 3D, model, tag…" /></div><div className="chip-row">{['all', 'image', 'video', 'web', '3d', 'game', 'research'].map((key) => <button key={key} className={`chip ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>{key === 'all' ? 'All' : CATEGORY_LABEL[key]}</button>)}</div></div><div className="result-line"><span>{prompts.length}개 프롬프트</span><span>원본 비율 유지</span></div><div className="prompt-masonry">{prompts.map((item) => <PromptCard key={item.id} item={item} onOpen={onOpen} />)}</div></> : <EmptyGallery onAdmin={onAdmin} />}
  </section>
}

function Ideas({ items, onOpen }) {
  const ideas = items.filter((item) => item.type === 'idea' || item.type === 'experiment').sort((a, b) => (b.updated || b.date || '').localeCompare(a.updated || a.date || ''))
  return <section className="shell page-view"><div className="page-hero"><p className="eyebrow">BACKLOG / THINKING / LEARNING</p><h1>Ideas & Experiments</h1><p>완성된 결과물 전 단계의 생각, 실험, 다음에 해볼 것들을 시간순으로 남깁니다.</p></div><div className="idea-grid">{ideas.map((item) => <button key={item.id} className="idea-card" onClick={() => onOpen(item)}><span>{formatDate(item.updated || item.date)}</span><h3>{item.title}</h3><p>{item.summary}</p><div>{(item.tags || []).slice(0, 4).map((tag) => <em key={tag}>#{tag}</em>)}</div></button>)}</div></section>
}

const EMPTY_FORM = { id: '', title: '', summary: '', category: 'image', model: 'ChatGPT Image', tags: '', prompt: '', date: new Date().toISOString().slice(0, 10), preview: '' }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('archive-admin-password') || '')
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [localPreview, setLocalPreview] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState([])

  const load = async () => {
    try { const res = await fetch('/data/gallery.json', { cache: 'no-store' }); const data = await res.json(); setItems(data.items || []) } catch { setItems([]) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  const chooseFile = (nextFile) => {
    if (!nextFile) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(nextFile.type)) { setStatus('PNG, JPG, WebP만 업로드할 수 있습니다.'); return }
    if (nextFile.size > 3 * 1024 * 1024) { setStatus('원본 업로드는 3MB 이하를 권장합니다. Vercel 요청 제한 때문에 더 큰 파일은 GitHub에 직접 추가한 뒤 이미지 경로를 입력하세요.'); return }
    if (localPreview) URL.revokeObjectURL(localPreview)
    setFile(nextFile); setLocalPreview(URL.createObjectURL(nextFile)); setStatus('')
  }

  const reset = () => { if (localPreview) URL.revokeObjectURL(localPreview); setForm(EMPTY_FORM); setFile(null); setLocalPreview(''); setStatus('') }
  const edit = (item) => { setForm({ id: item.id, title: item.title || '', summary: item.summary || '', category: item.category || 'image', model: item.model || '', tags: (item.tags || []).join(', '), prompt: item.prompt || '', date: item.date || new Date().toISOString().slice(0, 10), preview: item.preview || '' }); setFile(null); setLocalPreview(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const save = async (event) => {
    event.preventDefault()
    if (!password) { setStatus('관리자 비밀번호를 입력하세요.'); return }
    if (!form.title.trim() || !form.prompt.trim()) { setStatus('제목과 Prompt는 필수입니다.'); return }
    if (!file && !form.preview) { setStatus('이미지 파일을 선택하거나 기존 이미지 경로를 유지해야 합니다.'); return }
    setSaving(true); setStatus('저장 중…')
    try {
      const imageData = file ? await fileToDataUrl(file) : ''
      const res = await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ action: 'upsert', ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), imageData, imageName: file?.name || '' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      sessionStorage.setItem('archive-admin-password', password)
      setStatus('GitHub에 저장했습니다. Vercel 재배포가 끝나면 Prompt Gallery에 표시됩니다.')
      if (localPreview) URL.revokeObjectURL(localPreview)
      setForm(EMPTY_FORM); setFile(null); setLocalPreview('')
      setItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)])
    } catch (error) { setStatus(error.message) } finally { setSaving(false) }
  }

  const remove = async (item) => {
    if (!password || !confirm(`“${item.title}”을 갤러리에서 삭제할까요?`)) return
    setSaving(true)
    try {
      const res = await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ action: 'delete', id: item.id }) })
      const data = await res.json(); if (!res.ok) throw new Error(data.error || '삭제 실패')
      setItems((current) => current.filter((entry) => entry.id !== item.id)); setStatus('갤러리 metadata를 삭제했습니다. 이미지 파일은 안전을 위해 자동 삭제하지 않습니다.')
    } catch (error) { setStatus(error.message) } finally { setSaving(false) }
  }

  const preview = localPreview || form.preview
  return <section className="shell admin-view">
    <div className="admin-heading"><div><p className="eyebrow">PRIVATE PUBLISHER</p><h1>Add Prompt</h1><p>좋은 결과물만 직접 고릅니다. 업로드한 원본 이미지는 재압축하지 않고 GitHub에 저장합니다.</p></div><a href="/#prompts">← Gallery</a></div>
    <div className="admin-layout">
      <form className="admin-form" onSubmit={save}>
        <label>Admin password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vercel ADMIN_PASSWORD" autoComplete="current-password" /></label>
        <label className="upload-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files?.[0]) }}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} /><strong>{file ? file.name : form.preview ? '기존 이미지 유지' : '이미지를 드래그하거나 클릭'}</strong><span>PNG / JPG / WebP · 원본 그대로 · 권장 3MB 이하</span></label>
        <div className="admin-fields two"><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Model<input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="ChatGPT Image" /></label></div>
        <div className="admin-fields two"><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label></div>
        <label>Tags<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="character, anime, cinematic" /></label>
        <label>Summary<textarea rows="3" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="이 프롬프트가 만든 결과를 짧게 설명" /></label>
        <label>Prompt<textarea className="prompt-input" rows="12" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="실제로 사용한 전체 프롬프트" /></label>
        <div className="admin-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Publishing…' : form.id ? 'Update Prompt' : 'Publish Prompt'}</button>{form.id && <button type="button" className="ghost-btn" onClick={reset}>Cancel edit</button>}</div>
        {status && <p className="admin-status">{status}</p>}
        <div className="admin-env"><strong>Vercel 환경변수</strong><code>ADMIN_PASSWORD</code><code>GITHUB_TOKEN</code><span>선택: GITHUB_REPO, GITHUB_BRANCH</span></div>
      </form>
      <aside className="admin-preview"><p className="eyebrow">LIVE PREVIEW</p><div className="preview-frame">{preview ? <img src={preview} alt="업로드 미리보기" /> : <span>Image preview</span>}</div><h2>{form.title || 'Prompt title'}</h2><p>{form.summary || 'Summary will appear here.'}</p><div className="tag-list">{form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag}>#{tag}</span>)}</div></aside>
    </div>
    <section className="admin-existing"><div className="section-heading"><div><p className="eyebrow">PUBLISHED</p><h2>{items.length} prompts</h2></div></div><div className="admin-list">{items.map((item) => <div key={item.id}><img src={item.preview} alt="" /><span><strong>{item.title}</strong><small>{item.model} · {item.category}</small></span><button onClick={() => edit(item)}>Edit</button><button className="danger" onClick={() => remove(item)}>Delete</button></div>)}</div></section>
  </section>
}

export default function App() {
  const initialView = location.pathname.startsWith('/admin') ? 'admin' : (VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home')
  const [view, setView] = useState(initialView)
  const [items, setItems] = useState([])
  const [githubCount, setGithubCount] = useState(0)
  const [updated, setUpdated] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('archive-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('archive-theme', theme) }, [theme])
  useEffect(() => {
    const onHash = () => { if (location.pathname.startsWith('/admin')) return; const next = location.hash.slice(1); if (VIEWS.includes(next)) setView(next) }
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    let active = true
    Promise.all([loadArchive(), loadGithub().catch(() => [])]).then(([archive, github]) => { if (!active) return; setGithubCount(github.length); setUpdated(archive.updated || ''); setItems(mergeItems(archive.items || [], github)) }).catch((err) => active && setError(err.message))
    return () => { active = false }
  }, [])

  const navigate = (next) => {
    if (next === 'admin') { window.location.href = '/admin'; return }
    if (location.pathname.startsWith('/admin')) { window.location.href = `/#${next}`; return }
    setView(next); history.pushState(null, '', `#${next}`); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <>
    {view !== 'admin' && <Header view={view} onNavigate={navigate} theme={theme} onTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />}
    <main>
      {error && <div className="error-banner">{error}</div>}
      {view === 'home' && <Home items={items} githubCount={githubCount} onNavigate={navigate} onOpen={setSelected} />}
      {view === 'sites' && <ProjectBrowser items={items} onOpen={setSelected} />}
      {view === 'games' && <ProjectBrowser items={items} onOpen={setSelected} gameMode />}
      {view === 'prompts' && <Prompts items={items} onOpen={setSelected} onAdmin={() => navigate('admin')} />}
      {view === 'ideas' && <Ideas items={items} onOpen={setSelected} />}
      {view === 'admin' && <Admin />}
    </main>
    {view !== 'admin' && <><footer className="site-footer shell"><span>© {new Date().getFullYear()} BokEum Archive</span><span>{updated ? `${formatDate(updated)} · GitHub ${githubCount} repos synced` : 'loading archive…'}</span></footer><MobileNav view={view} onNavigate={navigate} /></>}
    {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
  </>
}
