const DEFAULT_REPO = 'BokEumEom/bokeum-archive'

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
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
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || `GitHub API ${response.status}`)
  return data
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function collectionConfig(collection) {
  if (collection === 'projects') {
    return {
      path: 'public/data/project-overrides.json',
      label: 'Project',
      requireChatgptSite: false,
    }
  }
  return {
    path: 'public/data/chatgpt-sites.json',
    label: 'ChatGPT Site',
    requireChatgptSite: true,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const adminPassword = process.env.ADMIN_PASSWORD
  const token = process.env.GITHUB_TOKEN
  if (!adminPassword || !token) return send(res, 503, { error: 'ADMIN_PASSWORD 또는 GITHUB_TOKEN이 설정되지 않았습니다.' })
  if (req.headers['x-admin-password'] !== adminPassword) return send(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { id, liveUrl, collection = 'chatgpt' } = body
  const config = collectionConfig(collection)

  if (!id || !validHttpsUrl(liveUrl)) return send(res, 400, { error: '정확한 https:// URL을 입력하세요.' })
  if (config.requireChatgptSite && !new URL(liveUrl).hostname.endsWith('.chatgpt.site')) {
    return send(res, 400, { error: 'ChatGPT Site는 https://*.chatgpt.site 주소를 입력하세요.' })
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'
  const [owner, name] = repo.split('/')
  const encodedPath = encodeURIComponent(config.path)

  try {
    const current = await github(`/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, token)
    const json = JSON.parse(Buffer.from(current.content, 'base64').toString('utf8'))
    const index = (json.items || []).findIndex((item) => item.id === id)
    if (index < 0) return send(res, 404, { error: '사이트 항목을 찾지 못했습니다.' })

    const item = json.items[index]
    const isChatgpt = collection !== 'projects'
    json.items[index] = {
      ...item,
      liveUrl,
      status: 'live',
      visibility: isChatgpt ? 'public' : item.visibility,
      visibilityTarget: isChatgpt ? undefined : item.visibilityTarget,
      updated: new Date().toISOString().slice(0, 10),
      sources: isChatgpt ? [...new Set([...(item.sources || []), 'chatgpt'])] : [...new Set([...(item.sources || []), new URL(liveUrl).hostname.includes('vercel.app') ? 'vercel' : 'manual'])],
      tags: isChatgpt ? [...new Set([...(item.tags || []).filter((tag) => tag !== 'needs-public-share'), 'public'])] : item.tags,
      notes: isChatgpt ? 'ChatGPT Site · Everyone · URL confirmed manually' : `${config.label} URL confirmed manually`,
    }
    json.updated = new Date().toISOString().slice(0, 10)

    const content = Buffer.from(JSON.stringify(json, null, 2)).toString('base64')
    await github(`/repos/${owner}/${name}/contents/${encodedPath}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: register ${config.label} URL for ${json.items[index].title}`,
        content,
        sha: current.sha,
        branch,
      }),
    })

    return send(res, 200, { ok: true, item: json.items[index] })
  } catch (error) {
    return send(res, 500, { error: error.message })
  }
}
