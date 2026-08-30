// server.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ====== CONFIG ======
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

// Telegram Drive REST API
// Beispiel im Docker: TELEGRAM_DRIVE_BASE_URL=http://telegram-drive:8550/api/v1
const TELEGRAM_DRIVE_BASE_URL =
  process.env.TELEGRAM_DRIVE_BASE_URL || 'http://localhost:8550/api/v1';
const TELEGRAM_DRIVE_API_KEY = process.env.TELEGRAM_DRIVE_API_KEY || null;

if (!TELEGRAM_DRIVE_API_KEY) {
  console.warn('WARN: TELEGRAM_DRIVE_API_KEY not set - REST calls will fail.');
}

// tRive Passwort (Single-User, Klartext-Vergleich)
// Bewusst kein Hashing mehr, um ENV-Escaping-Probleme mit $-Zeichen zu vermeiden.
// Absicherung des Docker-Hosts liegt in der Verantwortung des Betreibers.
const PASSWORD = process.env.PASSWORD || null;

if (!PASSWORD) {
  console.warn('WARN: Kein PASSWORD gesetzt. Setze ENV PASSWORD mit deinem tRive-Login-Passwort!');
}

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json());

// Upload (wir halten Datei im RAM und schicken sie durch zur REST-API)
const upload = multer({
  storage: multer.memoryStorage(),
});

// ====== AUTH-MIDDLEWARE ======
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ====== HELFER: REST-Aufrufe ======

async function tgDriveJson(pathname, { method = 'GET', query = {}, headers = {}, body } = {}) {
  const url = new URL(TELEGRAM_DRIVE_BASE_URL + pathname);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': TELEGRAM_DRIVE_API_KEY,
      ...headers,
    },
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `Telegram-Drive REST error: HTTP ${res.status}`;
    try {
      if (contentType.includes('application/json')) {
        const errBody = await res.json();
        msg += ` - ${JSON.stringify(errBody)}`;
      }
    } catch (_) {}
    throw new Error(msg);
  }

  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

async function tgDriveStream(pathname, { method = 'GET', query = {} } = {}) {
  const url = new URL(TELEGRAM_DRIVE_BASE_URL + pathname);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': TELEGRAM_DRIVE_API_KEY,
    },
  });

  if (!res.ok) {
    let msg = `Telegram-Drive REST stream error: HTTP ${res.status}`;
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errBody = await res.json();
        msg += ` - ${JSON.stringify(errBody)}`;
      }
    } catch (_) {}
    throw new Error(msg);
  }

  return res;
}

// ====== ROUTES: AUTH & HEALTH ======

app.get('/login', (req, res) => res.redirect('/'));
app.get('/admin', (req, res) => res.redirect('/'));

app.get('/api/health', async (req, res) => {
  try {
    const health = await fetch(TELEGRAM_DRIVE_BASE_URL + '/health'); // /health ohne API-Key erlaubt
    const data = await health.json();
    res.json({ status: 'ok', service: 'tdrive-backend', telegramDrive: data });
  } catch (err) {
    console.error(err);
    res.json({ status: 'degraded', service: 'tdrive-backend', telegramDrive: 'error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }
  if (!PASSWORD) {
    return res.status(500).json({ error: 'PASSWORD not configured on server' });
  }

  if (password !== PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ user: 'tdrive-user' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ====== FILE-LIST (/files) ======

app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const {
      page,
      limit,
      folder_id,
      search,
      offset_id,
      sort,
      order,
      mime_type,
      size_min,
      size_max,
    } = req.query;

    const data = await tgDriveJson('/files', {
      method: 'GET',
      query: {
        page,
        limit,
        folder_id,
        search,
        offset_id,
        sort,
        order,
        mime_type,
        size_min,
        size_max,
      },
    });

    const filesArray = data.files || data.data || [];
    const files = filesArray.map(f => ({
      id: f.id,
      folder_id: f.folder_id,
      name: f.name,
      size: f.size,
      mime_type: f.mime_type,
      created_at: f.created_at,
    }));

    res.json({
      files,
      page: data.page,
      limit: data.limit,
      total: data.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files', details: err.message });
  }
});

// ====== FILE-DETAILS (/files/{message_id}) ======

app.get('/api/files/:id', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  try {
    const file = await tgDriveJson(`/files/${encodeURIComponent(messageId)}`, {
      method: 'GET',
    });

    res.json(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get file details', details: err.message });
  }
});

// ====== DOWNLOAD (/files/{message_id}/download) ======

app.get('/api/download/:id', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { folder_id } = req.query;

  try {
    const tgRes = await tgDriveStream(`/files/${encodeURIComponent(messageId)}/download`, {
      method: 'GET',
      query: { folder_id },
    });

    const contentType = tgRes.headers.get('content-type') || 'application/octet-stream';
    const disposition = tgRes.headers.get('content-disposition') || '';
    let filename = 'download.bin';
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];

    const buffer = Buffer.from(await tgRes.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

// ====== SEARCH (/files/search?q=...) ======

app.get('/api/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'q (search query) is required' });
  }
  try {
    const data = await tgDriveJson('/files/search', {
      method: 'GET',
      query: { q },
    });
    const filesArray = data.files || data.data || [];
    const files = filesArray.map(f => ({
      id: f.id,
      folder_id: f.folder_id,
      name: f.name,
      size: f.size,
      mime_type: f.mime_type,
      created_at: f.created_at,
    }));
    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// ====== UPLOAD (POST /files multipart/form-data) ======

app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { folder_id } = req.body;

  try {
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), req.file.originalname);
    if (folder_id) {
      formData.append('folder_id', folder_id);
    }

    const result = await tgDriveJson('/files', {
      method: 'POST',
      body: formData,
    });

    res.json({
      message: 'File uploaded',
      file: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// ====== DELETE (DELETE /files/{message_id}) ======

app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { folder_id } = req.query;

  try {
    await tgDriveJson(`/files/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      query: { folder_id },
    });
    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

// ====== COPY (POST /files/{message_id}/copy) ======

app.post('/api/files/:id/copy', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { folder_id, source_folder_id } = req.body;

  try {
    const result = await tgDriveJson(`/files/${encodeURIComponent(messageId)}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_id,
        source_folder_id,
      }),
    });
    res.json({ message: 'File copied', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Copy failed', details: err.message });
  }
});

// ====== UPDATE (PATCH /files/{message_id}) - rename/move ======

app.patch('/api/files/:id', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { name, folder_id, source_folder_id } = req.body;

  try {
    const result = await tgDriveJson(`/files/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        folder_id,
        source_folder_id,
      }),
    });
    res.json({ message: 'File updated', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed', details: err.message });
  }
});

// ====== FOLDERS (/folders...) ======

app.get('/api/folders', authMiddleware, async (req, res) => {
  try {
    const folders = await tgDriveJson('/folders', { method: 'GET' });
    res.json(folders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list folders', details: err.message });
  }
});

app.post('/api/folders', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name required' });

  try {
    const result = await tgDriveJson('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    res.json({ message: 'Folder created', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Folder creation failed', details: err.message });
  }
});

app.patch('/api/folders/:folder_id', authMiddleware, async (req, res) => {
  const folderId = req.params.folder_id;
  const { name } = req.body;

  try {
    const result = await tgDriveJson(`/folders/${encodeURIComponent(folderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    res.json({ message: 'Folder renamed', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Folder rename failed', details: err.message });
  }
});

app.delete('/api/folders/:folder_id', authMiddleware, async (req, res) => {
  const folderId = req.params.folder_id;

  try {
    await tgDriveJson(`/folders/${encodeURIComponent(folderId)}`, {
      method: 'DELETE',
    });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Folder delete failed', details: err.message });
  }
});

// ====== STORAGE STATS (/storage/stats, /storage/duplicates, /folders/empty) ======

app.get('/api/storage/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await tgDriveJson('/storage/stats', { method: 'GET' });
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats failed', details: err.message });
  }
});

app.get('/api/storage/duplicates', authMiddleware, async (req, res) => {
  try {
    const duplicates = await tgDriveJson('/storage/duplicates', { method: 'GET' });
    res.json(duplicates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Duplicates failed', details: err.message });
  }
});

app.get('/api/folders/empty', authMiddleware, async (req, res) => {
  try {
    const emptyFolders = await tgDriveJson('/folders/empty', { method: 'GET' });
    res.json(emptyFolders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Empty folders failed', details: err.message });
  }
});

// ====== BULK OPERATIONS (/files/bulk) ======

app.post('/api/files/bulk', authMiddleware, async (req, res) => {
  const { action, file_ids, folder_id, payload } = req.body;
  if (!action || !Array.isArray(file_ids)) {
    return res.status(400).json({ error: 'action and file_ids[] required' });
  }

  try {
    const result = await tgDriveJson('/files/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        file_ids,
        folder_id,
        payload,
      }),
    });
    res.json({ message: 'Bulk operation executed', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk operation failed', details: err.message });
  }
});

// ====== SHARE (optional - falls Telegram-Drive dies unterstuetzt) ======

app.post('/api/share/:id', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { password, expiresInSeconds } = req.body || {};
  try {
    const result = await tgDriveJson(`/files/${encodeURIComponent(messageId)}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password || null,
        expires_in: expiresInSeconds || null,
      }),
    });
    res.json({
      shareUrl: result.url || result.share_url,
      password: result.password || password || null,
      expiresAt: result.expires_at || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Share link creation failed (Endpoint ggf. nicht verfuegbar)', details: err.message });
  }
});

// ====== STATIC FRONTEND ======

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/', express.static(path.join(__dirname, 'public')));

// ====== START ======
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`tDrive backend (Telegram-Drive REST) running on port ${PORT}`);
});
