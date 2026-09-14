const DEFAULT_REPO = 'BokEumEom/bokeum-archive'

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  return req.body || {}
}

function slugify(value) {
  return String(value || 'site').normalize('NFKD').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'site'
}

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bokeum-archive-site-manager',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }
  if (!response.ok) throw new Error(data.message || `GitHub API ${response.status}`)
  return data
}

function validHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function configFor(collection) {
  if (collection === 'projects') return { path: 'public/data/project-overrides.json', label: 'Project', requireChatgptSite: false }
  return { path: 'public/data/chatgpt-sites.json', label: 'ChatGPT Site', requireChatgptSite: true }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function deploymentSource(url) {
  const host = new URL(url).hostname
  if (host.endsWith('.vercel.app')) return 'vercel'
  if (host.endsWith('.chatgpt.site')) return 'chatgpt'
  if (host.endsWith('.workers.dev') || host.endsWith('.pages.dev')) return 'cloudflare'
  return 'manual'
}

async function loadJson(repo, branch, token, filePath) {
  const encodedPath = encodePath(filePath)
  const current = await github(`/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, token)
  const json = JSON.parse(Buffer.from(String(current.content || '').replace(/\n/g, ''), 'base64').toString('utf8'))
  return { json, sha: current.sha, encodedPath }
}

async function saveJson(repo, branch, token, encodedPath, sha, json, message) {
  await github(`/repos/${repo}/contents/${encodedPath}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(json, null, 2)}\n`).toString('base64'),
      sha,
      branch,
    }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const adminPassword = process.env.ADMIN_PASSWORD
  const token = process.env.GITHUB_TOKEN
  if (!adminPassword || !token) return send(res, 503, { error: 'Vercel에 ADMIN_PASSWORD와 GITHUB_TOKEN을 설정하세요.' })
  if (req.headers['x-admin-password'] !== adminPassword) return send(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' })

  const body = parseBody(req)
  const collection = body.collection === 'projects' ? 'projects' : 'chatgpt'
  const action = body.action === 'delete' ? 'delete' : 'upsert'
  const config = configFor(collection)
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'

  try {
    const { json, sha, encodedPath } = await loadJson(repo, branch, token, config.path)
    const items = Array.isArray(json.items) ? json.items : []
    const now = new Date().toISOString().slice(0, 10)

    if (action === 'delete') {
      const id = String(body.id || '').trim()
      if (!id) return send(res, 400, { error: '삭제할 id가 필요합니다.' })
      const nextItems = items.filter((item) => item.id !== id)
      if (nextItems.length === items.length) return send(res, 404, { error: '사이트 항목을 찾지 못했습니다.' })
      const next = { ...json, updated: now, items: nextItems }
      await saveJson(repo, branch, token, encodedPath, sha, next, `content: delete ${config.label} ${id}`)
      return send(res, 200, { ok: true, id })
    }

    const title = String(body.title || '').trim()
    const liveUrl = String(body.liveUrl || '').trim()
    if (!title || !liveUrl || !validHttpsUrl(liveUrl)) return send(res, 400, { error: 'title과 정확한 https:// URL이 필요합니다.' })
    if (config.requireChatgptSite && !new URL(liveUrl).hostname.endsWith('.chatgpt.site')) {
      return send(res, 400, { error: 'ChatGPT Site는 https://*.chatgpt.site 주소를 입력하세요.' })
    }

    const existing = body.id ? items.find((item) => item.id === body.id) : null
    const id = existing?.id || `${collection}-${slugify(title)}-${Date.now().toString(36)}`
    const source = deploymentSource(liveUrl)
    let item

    if (collection === 'chatgpt') {
      item = {
        ...(existing || {}),
        id,
        type: 'project',
        title,
        summary: String(body.summary || existing?.summary || 'ChatGPT Site에서 제작한 웹 프로젝트.').trim(),
        date: String(body.date || existing?.date || now),
        updated: now,
        status: 'public',
        visibility: 'public',
        featured: existing?.featured ?? false,
        sources: ['chatgpt'],
        tags: [...new Set([...(existing?.tags || []).filter((tag) => tag !== 'needs-public-share'), 'chatgpt-site', 'public'])],
        liveUrl,
        preview: existing?.preview || '',
        idea: existing?.idea || '',
        prompt: existing?.prompt || '',
        notes: 'ChatGPT Site · Everyone · URL confirmed manually',
      }
      delete item.visibilityTarget
    } else {
      const projectKind = body.projectKind === 'game' ? 'game' : String(body.projectKind || existing?.projectKind || 'site')
      const githubRepo = String(body.githubRepo || existing?.githubRepo || '').trim()
      item = {
        ...(existing || {}),
        id,
        type: 'project',
        projectKind,
        title,
        summary: String(body.summary || existing?.summary || 'Manual deployment project.').trim(),
        date: String(body.date || existing?.date || now),
        updated: now,
        status: 'live',
        featured: existing?.featured ?? false,
        sources: [...new Set([...(githubRepo ? ['github'] : []), source])],
        tags: [...new Set([...(existing?.tags || []), ...(projectKind === 'game' ? ['game'] : []), source])],
        githubRepo,
        liveUrl,
        preview: existing?.preview || '',
        idea: existing?.idea || '',
        prompt: existing?.prompt || '',
        notes: `${projectKind === 'game' ? 'Game' : 'Project'} override · deployment URL confirmed manually`,
      }
    }

    const nextItems = existing ? items.map((entry) => entry.id === id ? item : entry) : [item, ...items]
    const next = { ...json, updated: now, items: nextItems }
    await saveJson(repo, branch, token, encodedPath, sha, next, `content: ${existing ? 'update' : 'add'} ${config.label} ${title}`)
    return send(res, 200, { ok: true, item })
  } catch (error) {
    return send(res, 500, { error: error.message || '사이트 저장 중 오류가 발생했습니다.' })
  }
}
