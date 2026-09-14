const DEFAULT_REPO = 'BokEumEom/bokeum-archive'
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  return req.body || {}
}

function slugify(value) {
  return String(value || 'prompt')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'prompt'
}

function extensionFor(mime, name = '') {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  const match = name.toLowerCase().match(/\.(png|webp|jpe?g)$/)
  return match ? match[1].replace('jpeg', 'jpg') : 'png'
}

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bokeum-archive-publisher',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }
  if (!response.ok) throw new Error(data.message || `GitHub API ${response.status}`)
  return data
}

async function loadGallery(repo, branch, token) {
  const data = await github(`/repos/${repo}/contents/public/data/gallery.json?ref=${encodeURIComponent(branch)}`, token)
  const json = JSON.parse(Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8'))
  return { data: json, sha: data.sha }
}

async function saveGallery(repo, branch, token, gallery, sha) {
  return github(`/repos/${repo}/contents/public/data/gallery.json`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'content: update prompt gallery',
      branch,
      sha,
      content: Buffer.from(`${JSON.stringify(gallery, null, 2)}\n`).toString('base64'),
    }),
  })
}

async function uploadImage(repo, branch, token, title, imageData, imageName) {
  const match = String(imageData || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/)
  if (!match) throw new Error('PNG, JPG, WebP 이미지 데이터만 지원합니다.')
  const mime = match[1]
  const base64 = match[2]
  const bytes = Math.floor(base64.length * 3 / 4)
  if (bytes > MAX_IMAGE_BYTES) throw new Error('이미지는 3MB 이하여야 합니다. 큰 원본은 GitHub에 직접 추가한 뒤 기존 이미지 경로로 편집하세요.')
  const ext = extensionFor(mime, imageName)
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const path = `public/assets/gallery/${stamp}-${slugify(title)}.${ext}`
  await github(`/repos/${repo}/contents/${path}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `content: add ${title} image`, branch, content: base64 }),
  })
  return `/${path.replace(/^public\//, '')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const token = process.env.GITHUB_TOKEN
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!token || !adminPassword) return send(res, 503, { error: 'Vercel에 GITHUB_TOKEN과 ADMIN_PASSWORD 환경변수를 설정해야 합니다.' })

  const supplied = req.headers['x-admin-password']
  if (!supplied || supplied !== adminPassword) return send(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' })

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'

  try {
    const body = parseBody(req)
    const action = body.action || 'upsert'
    const { data: current, sha } = await loadGallery(repo, branch, token)
    const items = Array.isArray(current.items) ? current.items : []

    if (action === 'delete') {
      if (!body.id) return send(res, 400, { error: '삭제할 id가 필요합니다.' })
      const nextItems = items.filter((item) => item.id !== body.id)
      if (nextItems.length === items.length) return send(res, 404, { error: '해당 prompt를 찾지 못했습니다.' })
      const next = { updated: new Date().toISOString().slice(0, 10), items: nextItems }
      await saveGallery(repo, branch, token, next, sha)
      return send(res, 200, { ok: true, id: body.id })
    }

    const title = String(body.title || '').trim()
    const prompt = String(body.prompt || '').trim()
    if (!title || !prompt) return send(res, 400, { error: 'title과 prompt는 필수입니다.' })

    const existing = body.id ? items.find((item) => item.id === body.id) : null
    let preview = String(body.preview || existing?.preview || '').trim()
    if (body.imageData) preview = await uploadImage(repo, branch, token, title, body.imageData, body.imageName)
    if (!preview) return send(res, 400, { error: '이미지가 필요합니다.' })

    const now = new Date().toISOString().slice(0, 10)
    const id = existing?.id || `prompt-${slugify(title)}-${Date.now().toString(36)}`
    const item = {
      id,
      type: 'prompt',
      category: String(body.category || 'image'),
      model: String(body.model || 'ChatGPT Image').trim(),
      title,
      summary: String(body.summary || '').trim(),
      date: String(body.date || now),
      updated: now,
      status: 'published',
      featured: true,
      sources: ['manual'],
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12) : [],
      preview,
      prompt,
      notes: 'Manual Prompt Gallery upload',
    }

    const nextItems = existing
      ? items.map((entry) => entry.id === id ? item : entry)
      : [item, ...items]
    const next = { updated: now, items: nextItems }
    await saveGallery(repo, branch, token, next, sha)
    return send(res, 200, { ok: true, item })
  } catch (error) {
    return send(res, 500, { error: error.message || 'Prompt 저장 중 오류가 발생했습니다.' })
  }
}
