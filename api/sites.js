const DEFAULT_REPO = 'BokEumEom/bokeum-archive'

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  return req.body || {}
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const adminPassword = process.env.ADMIN_PASSWORD
  const token = process.env.GITHUB_TOKEN
  if (!adminPassword || !token) return send(res, 503, { error: 'Vercel에 ADMIN_PASSWORD와 GITHUB_TOKEN을 설정하세요.' })
  if (req.headers['x-admin-password'] !== adminPassword) return send(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' })

  const body = parseBody(req)
  const collection = body.collection === 'projects' ? 'projects' : 'chatgpt'
  const id = String(body.id || '').trim()
  const liveUrl = String(body.liveUrl || '').trim()
  const config = configFor(collection)

  if (!id || !validHttpsUrl(liveUrl)) return send(res, 400, { error: '정확한 https:// URL을 입력하세요.' })
  if (config.requireChatgptSite && !new URL(liveUrl).hostname.endsWith('.chatgpt.site')) {
    return send(res, 400, { error: 'ChatGPT Site는 https://*.chatgpt.site 주소를 입력하세요.' })
  }

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'
  const encodedPath = encodePath(config.path)

  try {
    const current = await github(`/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, token)
    const json = JSON.parse(Buffer.from(String(current.content || '').replace(/\n/g, ''), 'base64').toString('utf8'))
    const index = (json.items || []).findIndex((item) => item.id === id)
    if (index < 0) return send(res, 404, { error: '사이트 항목을 찾지 못했습니다.' })

    const now = new Date().toISOString().slice(0, 10)
    const item = json.items[index]
    const isChatgpt = collection === 'chatgpt'
    const source = deploymentSource(liveUrl)
    json.items[index] = {
      ...item,
      liveUrl,
      status: isChatgpt ? 'public' : 'live',
      updated: now,
      sources: isChatgpt
        ? [...new Set([...(item.sources || []), 'chatgpt'])]
        : [...new Set([...(item.sources || []).filter((entry) => entry !== 'manual'), 'github', source])],
      tags: isChatgpt
        ? [...new Set([...(item.tags || []).filter((tag) => tag !== 'needs-public-share'), 'public'])]
        : [...new Set([...(item.tags || []), source])],
      notes: isChatgpt ? 'ChatGPT Site · Everyone · URL confirmed manually' : `${config.label} deployment URL confirmed manually`,
    }
    if (isChatgpt) {
      json.items[index].visibility = 'public'
      delete json.items[index].visibilityTarget
    }
    json.updated = now

    await github(`/repos/${repo}/contents/${encodedPath}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `content: update ${config.label} URL for ${json.items[index].title}`,
        content: Buffer.from(`${JSON.stringify(json, null, 2)}\n`).toString('base64'),
        sha: current.sha,
        branch,
      }),
    })

    return send(res, 200, { ok: true, item: json.items[index] })
  } catch (error) {
    return send(res, 500, { error: error.message || '사이트 URL 저장 중 오류가 발생했습니다.' })
  }
}
