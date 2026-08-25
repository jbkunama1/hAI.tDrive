// ============ tDrive Frontend Logic ============
const API_BASE = '/api';

const state = {
  token: localStorage.getItem('tdrive_token') || null,
  currentFolderId: '',
  breadcrumbs: [{ id: '', name: 'Meine Ablage' }],
  view: 'grid',
  sort: 'created_at:desc',
  searchQuery: '',
  activeNav: 'all',
  files: [],
  contextTargetFile: null,
};

// ---------- Helpers ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iconForFile(file) {
  if (file.is_directory || (file.folder_id === null && file.mime_type === undefined && file.type === 'folder')) {
    return { cls: 'folder', glyph: '📁' };
  }
  const mime = (file.mime_type || '').toLowerCase();
  if (mime.startsWith('image/')) return { cls: 'image', glyph: '🖼️' };
  if (mime.startsWith('video/')) return { cls: 'video', glyph: '🎬' };
  if (mime.startsWith('audio/')) return { cls: 'audio', glyph: '🎵' };
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) return { cls: 'doc', glyph: '📄' };
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar')) return { cls: 'archive', glyph: '🗜️' };
  return { cls: 'generic', glyph: '📦' };
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error('Sitzung abgelaufen, bitte erneut einloggen.');
  }
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `Fehler ${res.status}`;
    if (contentType.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      msg = body.error || msg;
    }
    throw new Error(msg);
  }
  if (contentType.includes('application/json')) return res.json();
  return res;
}

// ---------- Auth ----------
function showScreen(name) {
  $('#login-screen').classList.toggle('hidden', name !== 'login');
  $('#app-screen').classList.toggle('hidden', name !== 'app');
}

async function checkHealth() {
  try {
    const data = await apiFetch('/health');
    $('#health-text').textContent = data.telegramDrive ? 'Server erreichbar' : 'Server laeuft (eingeschraenkt)';
  } catch (e) {
    $('#health-text').textContent = 'Server nicht erreichbar';
  }
}

async function login(password) {
  const loginBtn = $('#login-btn');
  const label = loginBtn.querySelector('.btn-label');
  const spinner = loginBtn.querySelector('.btn-spinner');
  const statusEl = $('#login-status');

  label.textContent = 'Wird geprueft...';
  spinner.classList.remove('hidden');
  statusEl.textContent = '';
  statusEl.className = 'status-text';

  try {
    const res = await fetch(API_BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login fehlgeschlagen');

    state.token = data.token;
    localStorage.setItem('tdrive_token', state.token);
    statusEl.textContent = 'Erfolgreich eingeloggt!';
    statusEl.className = 'status-text success';

    setTimeout(() => {
      showScreen('app');
      loadStorageStats();
      loadFiles();
    }, 350);
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'status-text error';
  } finally {
    label.textContent = 'Einloggen';
    spinner.classList.add('hidden');
  }
}

function logout() {
  state.token = null;
  localStorage.removeItem('tdrive_token');
  showScreen('login');
}

// ---------- Files ----------
async function loadFiles() {
  const grid = $('#file-grid');
  const emptyState = $('#empty-state');
  const resultCount = $('#result-count');

  const [sortField, sortOrder] = state.sort.split(':');
  const query = new URLSearchParams();
  query.set('limit', '100');
  query.set('sort', sortField);
  query.set('order', sortOrder);
  if (state.currentFolderId) query.set('folder_id', state.currentFolderId);

  try {
    let data;
    if (state.searchQuery) {
      data = await apiFetch(`/search?q=${encodeURIComponent(state.searchQuery)}`);
    } else if (state.activeNav === 'duplicates') {
      data = await apiFetch('/storage/duplicates');
      data = { files: (data.groups || data.duplicates || []).flat() };
    } else {
      data = await apiFetch(`/files?${query.toString()}`);
    }

    state.files = data.files || [];
    resultCount.textContent = `${state.files.length} Elemente`;

    grid.innerHTML = '';
    if (state.files.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      state.files.forEach(file => grid.appendChild(renderFileCard(file)));
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderFileCard(file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.dataset.id = file.id;

  const { cls, glyph } = iconForFile(file);

  const icon = document.createElement('div');
  icon.className = `file-icon ${cls}`;
  icon.textContent = glyph;

  const name = document.createElement('div');
  name.className = 'file-name';
  name.textContent = file.name || `Datei ${file.id}`;

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  meta.textContent = `${formatBytes(file.size)} - ${formatDate(file.created_at)}`;

  const menuBtn = document.createElement('button');
  menuBtn.className = 'file-menu-btn';
  menuBtn.innerHTML = '⋮';
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    openContextMenu(e, file);
  };

  card.appendChild(icon);
  card.appendChild(name);
  card.appendChild(meta);
  card.appendChild(menuBtn);

  card.addEventListener('click', () => {
    if (cls === 'folder') {
      enterFolder(file);
    } else {
      downloadFile(file);
    }
  });

  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openContextMenu(e, file);
  });

  return card;
}

function enterFolder(folder) {
  state.currentFolderId = folder.id;
  state.breadcrumbs.push({ id: folder.id, name: folder.name });
  renderBreadcrumb();
  loadFiles();
}

function renderBreadcrumb() {
  const container = $('#breadcrumb');
  container.innerHTML = '';
  state.breadcrumbs.forEach((crumb, idx) => {
    const span = document.createElement('span');
    span.className = 'crumb' + (idx === state.breadcrumbs.length - 1 ? ' active' : '');
    span.textContent = crumb.name;
    span.onclick = () => {
      state.breadcrumbs = state.breadcrumbs.slice(0, idx + 1);
      state.currentFolderId = crumb.id;
      renderBreadcrumb();
      loadFiles();
    };
    container.appendChild(span);
    if (idx < state.breadcrumbs.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = '/';
      container.appendChild(sep);
    }
  });
}

// ---------- Upload ----------
async function uploadFiles(fileList) {
  const progressList = $('#upload-progress-list');

  for (const file of fileList) {
    const item = document.createElement('div');
    item.className = 'upload-progress-item';
    item.innerHTML = `
      <div class="upload-progress-name"><span>${file.name}</span><span class="pct">0%</span></div>
      <div class="upload-progress-bar"><div class="upload-progress-fill"></div></div>
    `;
    progressList.appendChild(item);
    const fill = item.querySelector('.upload-progress-fill');
    const pctLabel = item.querySelector('.pct');

    try {
      await uploadSingleFile(file, (pct) => {
        fill.style.width = pct + '%';
        pctLabel.textContent = pct + '%';
      });
      fill.style.width = '100%';
      pctLabel.textContent = 'Fertig';
      showToast(`${file.name} hochgeladen`, 'success');
      setTimeout(() => item.remove(), 1500);
    } catch (err) {
      pctLabel.textContent = 'Fehler';
      showToast(`Upload fehlgeschlagen: ${file.name}`, 'error');
    }
  }

  loadFiles();
  loadStorageStats();
}

function uploadSingleFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + '/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error'));

    const formData = new FormData();
    formData.append('file', file);
    if (state.currentFolderId) formData.append('folder_id', state.currentFolderId);
    xhr.send(formData);
  });
}

// ---------- Download / Delete / Rename ----------
async function downloadFile(file) {
  try {
    const res = await apiFetch(`/download/${file.id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteFile(file) {
  if (!confirm(`"${file.name}" wirklich loeschen?`)) return;
  try {
    await apiFetch(`/files/${file.id}`, { method: 'DELETE' });
    showToast('Datei geloescht', 'success');
    loadFiles();
    loadStorageStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRenameModal(file) {
  openModal(`
    <h3>Datei umbenennen</h3>
    <input type="text" id="rename-input" class="text-input" value="${file.name}" />
    <div class="modal-actions">
      <button class="btn-secondary" id="modal-cancel">Abbrechen</button>
      <button class="btn-primary" id="modal-confirm">Speichern</button>
    </div>
  `);
  $('#modal-cancel').onclick = closeModal;
  $('#modal-confirm').onclick = async () => {
    const newName = $('#rename-input').value.trim();
    if (!newName) return;
    try {
      await apiFetch(`/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      showToast('Umbenannt', 'success');
      closeModal();
      loadFiles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function openShareModal(file) {
  openModal(`
    <h3>Link teilen</h3>
    <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.8rem;">Erstelle einen Freigabelink fuer "${file.name}".</p>
    <input type="password" id="share-password" class="text-input" placeholder="Optionales Passwort" />
    <div class="modal-actions">
      <button class="btn-secondary" id="modal-cancel">Abbrechen</button>
      <button class="btn-primary" id="modal-confirm">Link erstellen</button>
    </div>
  `);
  $('#modal-cancel').onclick = closeModal;
  $('#modal-confirm').onclick = async () => {
    const password = $('#share-password').value;
    try {
      const result = await apiFetch(`/share/${file.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || null }),
      });
      openModal(`
        <h3>Link erstellt</h3>
        <input type="text" class="text-input" readonly value="${result.shareUrl || ''}" onclick="this.select()" />
        <div class="modal-actions">
          <button class="btn-primary" id="modal-close">Fertig</button>
        </div>
      `);
      $('#modal-close').onclick = closeModal;
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function openNewFolderModal() {
  openModal(`
    <h3>Neuer Ordner</h3>
    <input type="text" id="folder-name-input" class="text-input" placeholder="Ordnername" />
    <div class="modal-actions">
      <button class="btn-secondary" id="modal-cancel">Abbrechen</button>
      <button class="btn-primary" id="modal-confirm">Erstellen</button>
    </div>
  `);
  $('#modal-cancel').onclick = closeModal;
  $('#modal-confirm').onclick = async () => {
    const name = $('#folder-name-input').value.trim();
    if (!name) return;
    try {
      await apiFetch('/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      showToast('Ordner erstellt', 'success');
      closeModal();
      loadFiles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ---------- Modal ----------
function openModal(html) {
  $('#modal-box').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}
function closeModal() {
  $('#modal-overlay').classList.add('hidden');
}

// ---------- Context menu ----------
function openContextMenu(e, file) {
  state.contextTargetFile = file;
  const menu = $('#context-menu');
  menu.classList.remove('hidden');
  const x = Math.min(e.clientX, window.innerWidth - 210);
  const y = Math.min(e.clientY, window.innerHeight - 260);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}
function closeContextMenu() {
  $('#context-menu').classList.add('hidden');
  state.contextTargetFile = null;
}

// ---------- Storage stats ----------
async function loadStorageStats() {
  try {
    const stats = await apiFetch('/storage/stats');
    const used = stats.total_storage_used_bytes || 0;
    const cap = 2 * 1024 * 1024 * 1024 * 1024; // 2TB Referenzwert, rein visuell
    const pct = Math.min(100, (used / cap) * 100);
    $('#storage-bar-fill').style.width = pct + '%';
    $('#storage-meta').textContent = `${formatBytes(used)} - ${stats.total_file_count || 0} Dateien`;
  } catch (err) {
    $('#storage-meta').textContent = 'Statistik nicht verfuegbar';
  }
}

// ---------- Event bindings ----------
function bindEvents() {
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = $('#password-input').value;
    if (!password) return;
    login(password);
  });

  $('#toggle-password').addEventListener('click', () => {
    const input = $('#password-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('#logout-btn').addEventListener('click', logout);

  $('#menu-btn').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    $('#sidebar-overlay').classList.remove('hidden');
  });
  $('#sidebar-overlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.add('hidden');
  });

  $('#search-input').addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim();
    loadFiles();
  }, 400));

  $('#sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    loadFiles();
  });

  $('#view-grid').addEventListener('click', () => setView('grid'));
  $('#view-list').addEventListener('click', () => setView('list'));

  $all('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      $all('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeNav = btn.dataset.view;
      state.searchQuery = '';
      $('#search-input').value = '';
      loadFiles();
      $('#sidebar').classList.remove('open');
      $('#sidebar-overlay').classList.add('hidden');
    });
  });

  $('#new-folder-btn').addEventListener('click', openNewFolderModal);

  const fileInput = $('#file-input');
  $('#upload-drop').addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) uploadFiles(Array.from(e.target.files));
    fileInput.value = '';
  });

  const dropZone = $('#upload-drop');
  ['dragover', 'dragenter'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) uploadFiles(Array.from(e.dataTransfer.files));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) closeContextMenu();
  });

  $('#context-menu').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const file = state.contextTargetFile;
    if (!action || !file) return;
    closeContextMenu();

    if (action === 'download') downloadFile(file);
    if (action === 'rename') openRenameModal(file);
    if (action === 'share') openShareModal(file);
    if (action === 'delete') deleteFile(file);
    if (action === 'copy') copyFilePrompt(file);
    if (action === 'move') movePrompt(file);
  });

  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
}

function setView(view) {
  state.view = view;
  $('#view-grid').classList.toggle('active', view === 'grid');
  $('#view-list').classList.toggle('active', view === 'list');
  $('#file-grid').classList.toggle('list-view', view === 'list');
}

function copyFilePrompt(file) {
  const targetFolderId = prompt('Ziel-Ordner-ID zum Kopieren eingeben:');
  if (!targetFolderId) return;
  apiFetch(`/files/${file.id}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: targetFolderId, source_folder_id: state.currentFolderId || null }),
  }).then(() => {
    showToast('Datei kopiert', 'success');
    loadFiles();
  }).catch(err => showToast(err.message, 'error'));
}

function movePrompt(file) {
  const targetFolderId = prompt('Ziel-Ordner-ID zum Verschieben eingeben:');
  if (!targetFolderId) return;
  apiFetch(`/files/${file.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: targetFolderId, source_folder_id: state.currentFolderId || null }),
  }).then(() => {
    showToast('Datei verschoben', 'success');
    loadFiles();
  }).catch(err => showToast(err.message, 'error'));
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------- Init ----------
function init() {
  bindEvents();
  checkHealth();

  if (state.token) {
    showScreen('app');
    loadStorageStats();
    loadFiles();
  } else {
    showScreen('login');
  }
}

document.addEventListener('DOMContentLoaded', init);
