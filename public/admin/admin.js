const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const state = {
  gallery: [],
  chatgpt: [],
  projects: [],
  view: 'dashboard',
  siteCollection: 'chatgpt',
  siteQuery: '',
  editingPrompt: null,
  imageData: '',
  imageName: '',
}

const els = {}

function password() { return els.password.value.trim() }
function setStatus(el, message, error = false) {
  el.textContent = message || ''
  el.classList.toggle('error', Boolean(error))
}
function safeText(value) { return String(value ?? '') }
function escapeHtml(value) {
  return safeText(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
function hostOf(url) {
  try { return new URL(url).hostname } catch { return '' }
}

async function api(path, body) {
  if (!password()) throw new Error('관리자 비밀번호를 입력하세요.')
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password() },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`)
  sessionStorage.setItem('archive-admin-password', password())
  return data
}

async function loadJson(path) {
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${path} 로드 실패`)
  return response.json()
}

async function refreshAll() {
  const [gallery, chatgpt, projects] = await Promise.all([
    loadJson('/data/gallery.json'),
    loadJson('/data/chatgpt-sites.json'),
    loadJson('/data/project-overrides.json'),
  ])
  state.gallery = gallery.items || []
  state.chatgpt = chatgpt.items || []
  state.projects = projects.items || []
  renderAll()
}

function setView(view) {
  state.view = ['dashboard', 'sites', 'gallery', 'settings'].includes(view) ? view : 'dashboard'
  $$('.view').forEach((node) => node.classList.toggle('active', node.id === `view-${state.view}`))
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view))
  els.pageTitle.textContent = ({ dashboard: 'Dashboard', sites: 'Site URLs', gallery: 'Image Gallery', settings: 'Settings' })[state.view]
  if (location.hash !== `#${state.view}`) history.replaceState(null, '', `#${state.view}`)
  if (state.view === 'sites') renderSites()
  if (state.view === 'gallery') renderGallery()
}

function renderDashboard() {
  const missing = state.chatgpt.filter((item) => !item.liveUrl).length + state.projects.filter((item) => !item.liveUrl).length
  const games = state.projects.filter((item) => item.projectKind === 'game' || (item.tags || []).includes('game')).length
  els.statSites.textContent = String(state.chatgpt.length + state.projects.length)
  els.statMissing.textContent = String(missing)
  els.statPrompts.textContent = String(state.gallery.length)
  els.statGames.textContent = String(games)

  const recent = [
    ...state.gallery.map((item) => ({ ...item, kind: 'Prompt' })),
    ...state.chatgpt.map((item) => ({ ...item, kind: 'ChatGPT Site' })),
    ...state.projects.map((item) => ({ ...item, kind: item.projectKind === 'game' ? 'Game' : 'Project' })),
  ].sort((a, b) => safeText(b.updated || b.date).localeCompare(safeText(a.updated || a.date))).slice(0, 7)

  els.recentList.innerHTML = recent.length ? recent.map((item) => `
    <div class="site-row" style="grid-template-columns:minmax(0,1fr) auto">
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.kind)} · ${escapeHtml(item.updated || item.date || '날짜 없음')}</small></div>
      <span class="badge ${item.liveUrl || item.type === 'prompt' ? 'good' : 'missing'}">${item.liveUrl || item.type === 'prompt' ? 'Ready' : 'URL missing'}</span>
    </div>`).join('') : '<p class="muted">아직 등록된 항목이 없습니다.</p>'
}

function siteItems() { return state.siteCollection === 'projects' ? state.projects : state.chatgpt }
function renderSites() {
  const items = siteItems().filter((item) => {
    const hay = `${item.title} ${item.liveUrl || ''} ${item.githubRepo || ''}`.toLowerCase()
    return hay.includes(state.siteQuery.toLowerCase())
  })
  els.siteSourceLabel.textContent = state.siteCollection === 'projects' ? 'Project overrides' : 'ChatGPT Sites'
  els.siteCount.textContent = `${items.length} items`
  els.siteList.innerHTML = items.length ? items.map((item) => `
    <div class="site-row" data-id="${escapeHtml(item.id)}">
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.githubRepo || hostOf(item.liveUrl) || 'URL not registered')}</small><span class="badge ${item.liveUrl ? 'good' : 'missing'}">${item.liveUrl ? 'Live URL' : 'URL missing'}</span></div>
      <input class="site-url-input" type="url" value="${escapeHtml(item.liveUrl || '')}" placeholder="${state.siteCollection === 'chatgpt' ? 'https://name.bokeum.chatgpt.site' : 'https://project.vercel.app/'}" />
      <button class="btn save-site" type="button">Save</button>
      ${item.liveUrl ? `<a class="btn ghost" href="${escapeHtml(item.liveUrl)}" target="_blank" rel="noreferrer" style="text-decoration:none;text-align:center">Open ↗</a>` : '<button class="btn ghost edit-site" type="button">Edit</button>'}
    </div>`).join('') : '<p class="muted">검색 결과가 없습니다.</p>'

  $$('.save-site', els.siteList).forEach((button) => button.addEventListener('click', saveSiteInline))
  $$('.edit-site', els.siteList).forEach((button) => button.addEventListener('click', () => openSiteModal(button.closest('.site-row').dataset.id)))
}

async function saveSiteInline(event) {
  const row = event.currentTarget.closest('.site-row')
  const id = row.dataset.id
  const item = siteItems().find((entry) => entry.id === id)
  const liveUrl = $('.site-url-input', row).value.trim()
  const button = event.currentTarget
  button.disabled = true
  setStatus(els.siteStatus, '저장 중…')
  try {
    await api('/api/sites', { action: 'upsert', collection: state.siteCollection, id, title: item.title, liveUrl, summary: item.summary, projectKind: item.projectKind, githubRepo: item.githubRepo })
    setStatus(els.siteStatus, `${item.title} URL을 저장했습니다.`)
    await refreshAll()
  } catch (error) { setStatus(els.siteStatus, error.message, true) }
  finally { button.disabled = false }
}

function openSiteModal(id = '') {
  const item = siteItems().find((entry) => entry.id === id)
  els.siteModalTitle.textContent = item ? 'Edit deployment' : 'Add deployment'
  els.siteId.value = item?.id || ''
  els.siteTitle.value = item?.title || ''
  els.siteLiveUrl.value = item?.liveUrl || ''
  els.siteSummary.value = item?.summary || ''
  els.siteGithub.value = item?.githubRepo || ''
  els.siteKind.value = item?.projectKind || 'site'
  els.projectFields.hidden = state.siteCollection !== 'projects'
  els.siteDelete.hidden = !item
  setStatus(els.siteModalStatus, '')
  els.siteModal.classList.add('open')
}
function closeSiteModal() { els.siteModal.classList.remove('open') }

async function submitSiteModal(event) {
  event.preventDefault()
  const body = {
    action: 'upsert', collection: state.siteCollection,
    id: els.siteId.value || undefined,
    title: els.siteTitle.value.trim(), liveUrl: els.siteLiveUrl.value.trim(), summary: els.siteSummary.value.trim(),
    projectKind: els.siteKind.value, githubRepo: els.siteGithub.value.trim(),
  }
  setStatus(els.siteModalStatus, '저장 중…')
  els.siteSubmit.disabled = true
  try {
    await api('/api/sites', body)
    closeSiteModal(); setStatus(els.siteStatus, `${body.title}을 저장했습니다.`); await refreshAll()
  } catch (error) { setStatus(els.siteModalStatus, error.message, true) }
  finally { els.siteSubmit.disabled = false }
}

async function deleteSite() {
  const id = els.siteId.value
  const item = siteItems().find((entry) => entry.id === id)
  if (!item || !confirm(`“${item.title}” 관리 항목을 삭제할까요?`)) return
  try {
    await api('/api/sites', { action: 'delete', collection: state.siteCollection, id })
    closeSiteModal(); setStatus(els.siteStatus, `${item.title}을 삭제했습니다.`); await refreshAll()
  } catch (error) { setStatus(els.siteModalStatus, error.message, true) }
}

function renderGallery() {
  els.promptCount.textContent = `${state.gallery.length} prompts`
  els.promptList.innerHTML = state.gallery.length ? state.gallery.map((item) => `
    <div class="prompt-row" data-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.preview)}" alt="" loading="lazy" />
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.model || 'Prompt')} · ${escapeHtml(item.category || 'image')} · ${escapeHtml((item.tags || []).slice(0, 3).join(', '))}</small></div>
      <button class="btn edit-prompt" type="button">Edit</button>
      <button class="btn danger delete-prompt" type="button">Delete</button>
    </div>`).join('') : '<p class="muted">등록된 이미지 프롬프트가 없습니다. 위 폼에서 첫 항목을 게시하세요.</p>'
  $$('.edit-prompt', els.promptList).forEach((button) => button.addEventListener('click', () => editPrompt(button.closest('.prompt-row').dataset.id)))
  $$('.delete-prompt', els.promptList).forEach((button) => button.addEventListener('click', () => deletePrompt(button.closest('.prompt-row').dataset.id)))
}

function resetPromptForm() {
  state.editingPrompt = null; state.imageData = ''; state.imageName = ''
  els.promptForm.reset(); els.promptModel.value = 'ChatGPT Image'; els.promptCategory.value = 'image'; els.promptDate.value = new Date().toISOString().slice(0, 10)
  els.promptPublish.textContent = 'Publish Prompt'; els.promptCancel.hidden = true; els.fileLabel.textContent = '이미지를 드래그하거나 클릭';
  els.previewBox.innerHTML = '<span>Image preview</span>'; els.previewTitle.textContent = 'Prompt title'; els.previewSummary.textContent = 'Summary will appear here.'; setStatus(els.promptStatus, '')
}

function editPrompt(id) {
  const item = state.gallery.find((entry) => entry.id === id); if (!item) return
  state.editingPrompt = item; state.imageData = ''; state.imageName = ''
  els.promptTitle.value = item.title || ''; els.promptModel.value = item.model || 'ChatGPT Image'; els.promptCategory.value = item.category || 'image'; els.promptDate.value = item.date || ''
  els.promptTags.value = (item.tags || []).join(', '); els.promptSummary.value = item.summary || ''; els.promptText.value = item.prompt || ''
  els.promptPublish.textContent = 'Update Prompt'; els.promptCancel.hidden = false; els.fileLabel.textContent = '새 이미지로 교체하려면 선택';
  showPreview(item.preview, item.title, item.summary); window.scrollTo({ top: 0, behavior: 'smooth' })
}

function showPreview(src, title = '', summary = '') {
  els.previewBox.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="preview" />` : '<span>Image preview</span>'
  els.previewTitle.textContent = title || 'Prompt title'; els.previewSummary.textContent = summary || 'Summary will appear here.'
}

async function handleImage(file) {
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setStatus(els.promptStatus, 'PNG/JPG/WebP만 지원합니다.', true)
  if (file.size > 3 * 1024 * 1024) return setStatus(els.promptStatus, `이미지가 ${formatBytes(file.size)}입니다. 현재 업로드 한도는 3MB입니다.`, true)
  state.imageData = await fileToDataUrl(file); state.imageName = file.name
  els.fileLabel.textContent = `${file.name} · ${formatBytes(file.size)}`
  showPreview(state.imageData, els.promptTitle.value, els.promptSummary.value)
}

async function submitPrompt(event) {
  event.preventDefault()
  const title = els.promptTitle.value.trim(); const prompt = els.promptText.value.trim()
  if (!title || !prompt) return setStatus(els.promptStatus, 'Title과 Prompt는 필수입니다.', true)
  if (!state.editingPrompt && !state.imageData) return setStatus(els.promptStatus, '이미지를 선택하세요.', true)
  const body = {
    action: 'upsert', id: state.editingPrompt?.id, title, prompt,
    model: els.promptModel.value.trim(), category: els.promptCategory.value, date: els.promptDate.value,
    tags: els.promptTags.value.split(',').map((tag) => tag.trim()).filter(Boolean), summary: els.promptSummary.value.trim(),
    preview: state.editingPrompt?.preview || '', imageData: state.imageData || undefined, imageName: state.imageName || undefined,
  }
  els.promptPublish.disabled = true; setStatus(els.promptStatus, 'GitHub에 게시 중…')
  try {
    await api('/api/prompts', body); setStatus(els.promptStatus, state.editingPrompt ? '프롬프트를 수정했습니다.' : '프롬프트를 게시했습니다.'); resetPromptForm(); await refreshAll()
  } catch (error) { setStatus(els.promptStatus, error.message, true) }
  finally { els.promptPublish.disabled = false }
}

async function deletePrompt(id) {
  const item = state.gallery.find((entry) => entry.id === id)
  if (!item || !confirm(`“${item.title}” 프롬프트를 삭제할까요?\n이미지 파일 자체는 GitHub에 남을 수 있습니다.`)) return
  try { await api('/api/prompts', { action: 'delete', id }); setStatus(els.promptStatus, `${item.title}을 삭제했습니다.`); await refreshAll() }
  catch (error) { setStatus(els.promptStatus, error.message, true) }
}

function renderAll() { renderDashboard(); renderSites(); renderGallery() }

function bind() {
  Object.assign(els, {
    password: $('#password'), pageTitle: $('#page-title'), statSites: $('#stat-sites'), statMissing: $('#stat-missing'), statPrompts: $('#stat-prompts'), statGames: $('#stat-games'), recentList: $('#recent-list'),
    siteList: $('#site-list'), siteStatus: $('#site-status'), siteCount: $('#site-count'), siteSourceLabel: $('#site-source-label'), siteSearch: $('#site-search'),
    siteModal: $('#site-modal'), siteModalTitle: $('#site-modal-title'), siteModalStatus: $('#site-modal-status'), siteId: $('#site-id'), siteTitle: $('#site-title'), siteLiveUrl: $('#site-live-url'), siteSummary: $('#site-summary'), siteGithub: $('#site-github'), siteKind: $('#site-kind'), projectFields: $('#project-fields'), siteSubmit: $('#site-submit'), siteDelete: $('#site-delete'),
    promptForm: $('#prompt-form'), promptTitle: $('#prompt-title'), promptModel: $('#prompt-model'), promptCategory: $('#prompt-category'), promptDate: $('#prompt-date'), promptTags: $('#prompt-tags'), promptSummary: $('#prompt-summary'), promptText: $('#prompt-text'), promptPublish: $('#prompt-publish'), promptCancel: $('#prompt-cancel'), promptStatus: $('#prompt-status'), promptCount: $('#prompt-count'), promptList: $('#prompt-list'), imageInput: $('#image-input'), fileLabel: $('#file-label'), drop: $('#drop'), previewBox: $('#preview-box'), previewTitle: $('#preview-title'), previewSummary: $('#preview-summary'),
  })
  els.password.value = sessionStorage.getItem('archive-admin-password') || ''
  $('#remember').addEventListener('click', () => { sessionStorage.setItem('archive-admin-password', password()); $('#remember').textContent = 'Saved ✓'; setTimeout(() => $('#remember').textContent = 'Remember', 1200) })
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)))
  $$('[data-site-collection]').forEach((button) => button.addEventListener('click', () => { state.siteCollection = button.dataset.siteCollection; $$('[data-site-collection]').forEach((b) => b.classList.toggle('active', b === button)); renderSites() }))
  els.siteSearch.addEventListener('input', () => { state.siteQuery = els.siteSearch.value; renderSites() })
  $('#add-site').addEventListener('click', () => openSiteModal())
  $('#site-form').addEventListener('submit', submitSiteModal); $('#site-delete').addEventListener('click', deleteSite); $('#site-close').addEventListener('click', closeSiteModal)
  els.siteModal.addEventListener('mousedown', (event) => { if (event.target === els.siteModal) closeSiteModal() })
  els.promptForm.addEventListener('submit', submitPrompt); els.promptCancel.addEventListener('click', resetPromptForm)
  els.imageInput.addEventListener('change', () => handleImage(els.imageInput.files?.[0]))
  els.drop.addEventListener('dragover', (event) => { event.preventDefault(); els.drop.classList.add('drag') }); els.drop.addEventListener('dragleave', () => els.drop.classList.remove('drag'))
  els.drop.addEventListener('drop', (event) => { event.preventDefault(); els.drop.classList.remove('drag'); handleImage(event.dataTransfer.files?.[0]) })
  ;[els.promptTitle, els.promptSummary].forEach((input) => input.addEventListener('input', () => showPreview(state.imageData || state.editingPrompt?.preview || '', els.promptTitle.value, els.promptSummary.value)))
  $('#quick-site').addEventListener('click', () => setView('sites')); $('#quick-prompt').addEventListener('click', () => setView('gallery'))
  window.addEventListener('hashchange', () => setView(location.hash.slice(1)))
}

async function init() {
  bind(); resetPromptForm(); setView(location.hash.slice(1) || 'dashboard')
  try { await refreshAll() } catch (error) { console.error(error); $('#global-status').textContent = error.message }
}

document.addEventListener('DOMContentLoaded', init)
