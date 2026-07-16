const offlinePanel = document.getElementById('offline-panel')
const loginPanel = document.getElementById('login-panel')
const uploadPanel = document.getElementById('upload-panel')
const logoutBtn = document.getElementById('logout-btn')
const loginForm = document.getElementById('login-form')
const loginError = document.getElementById('login-error')
const uploadForm = document.getElementById('upload-form')
const uploadStatus = document.getElementById('upload-status')
const manifestList = document.getElementById('manifest-list')

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

function setOffline(on) {
  if (offlinePanel) offlinePanel.hidden = !on
  if (loginPanel) loginPanel.hidden = on
  if (uploadPanel) uploadPanel.hidden = true
  if (logoutBtn) logoutBtn.hidden = true
}

function setAuthed(on) {
  if (offlinePanel) offlinePanel.hidden = true
  loginPanel.hidden = on
  uploadPanel.hidden = !on
  logoutBtn.hidden = !on
}

function showUploadStatus(text, ok) {
  uploadStatus.hidden = !text
  uploadStatus.textContent = text
  uploadStatus.classList.toggle('ok', Boolean(ok))
  uploadStatus.classList.toggle('bad', Boolean(text) && !ok)
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function renderManifest(items) {
  if (!items?.length) {
    manifestList.innerHTML = '<p class="manifest-empty">No uploads yet.</p>'
    return
  }
  manifestList.innerHTML = items
    .map(
      (item) => `
      <article class="manifest-row" data-id="${item.id}">
        <div class="manifest-meta">
          <div class="manifest-title">${escapeHtml(item.title)}</div>
          <div class="manifest-sub">${escapeHtml(item.type)} · ${escapeHtml(item.path)} · ${escapeHtml(formatDate(item.createdAt))}</div>
        </div>
        <button type="button" class="delete-btn" data-delete="${item.id}">Delete</button>
      </article>`,
    )
    .join('')
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function refreshManifest() {
  const data = await api('/api/manifest')
  renderManifest(data.items || [])
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  loginError.hidden = true
  const fd = new FormData(loginForm)
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: fd.get('password') }),
    })
    setAuthed(true)
    await refreshManifest()
  } catch (err) {
    loginError.textContent = err.message || 'Login failed'
    loginError.hidden = false
  }
})

logoutBtn?.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' })
  setAuthed(false)
})

uploadForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  showUploadStatus('Uploading…', true)
  const fd = new FormData(uploadForm)
  try {
    const data = await api('/api/upload', { method: 'POST', body: fd })
    showUploadStatus(`Uploaded “${data.item?.title ?? 'file'}”`, true)
    uploadForm.reset()
    renderManifest(data.manifest?.items || [])
  } catch (err) {
    showUploadStatus(err.message || 'Upload failed', false)
  }
})

manifestList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-delete]')
  if (!btn) return
  const id = btn.getAttribute('data-delete')
  if (!id || !confirm('Delete this item from the portfolio?')) return
  try {
    const data = await api('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    renderManifest(data.manifest?.items || [])
  } catch (err) {
    alert(err.message || 'Delete failed')
  }
})

/** True when Express API is reachable (local `npm run dev` / `npm start`). */
async function apiReachable() {
  try {
    const res = await fetch('/api/health', { credentials: 'include' })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return Boolean(data && data.ok !== false)
  } catch {
    return false
  }
}

async function boot() {
  const online = await apiReachable()
  if (!online) {
    setOffline(true)
    return
  }

  try {
    const session = await api('/api/session')
    setAuthed(Boolean(session.authenticated))
    if (session.authenticated) await refreshManifest()
  } catch {
    setAuthed(false)
  }
}

void boot()
