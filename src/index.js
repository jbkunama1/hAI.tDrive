const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONFIG_FILE = path.join(__dirname, '../config.json');
const STORAGE_DIR = path.join(__dirname, '../storage');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Admin Setup & Dashboard UI
app.get('/', (req, res) => {
    const config = loadConfig();
    const needsSetup = !config.initialized;

    if (needsSetup) {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>tRive - Initial Setup</title>
                <style>
                    body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 30px; border-radius: 12px; width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                    h2 { color: #38bdf8; text-align: center; }
                    label { display: block; margin-top: 10px; font-size: 0.9rem; color: #94a3b8; }
                    input { width: 100%; padding: 10px; margin-top: 5px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; box-sizing: border-box; }
                    button { width: 100%; margin-top: 20px; padding: 12px; background: #0ea5e9; border: none; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; }
                    button:hover { background: #0284c7; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 tRive Initial Setup</h2>
                    <form action="/setup" method="POST">
                        <label>Initial Admin Password</label>
                        <input type="password" name="password" required placeholder="Enter initial password">
                        <label>JWT Secret</label>
                        <input type="text" name="jwt" required placeholder="super-secret-jwt-key">
                        <label>Port</label>
                        <input type="number" name="port" value="3000" required>
                        <label>API Server URL</label>
                        <input type="text" name="apiServer" placeholder="https://api.example.com">
                        <label>API Key</label>
                        <input type="password" name="apiKey" placeholder="api-key">
                        <button type="submit">Complete Setup</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>tRive - Dashboard & File Manager</title>
                <style>
                    body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
                    .container { max-width: 800px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                    h2 { color: #38bdf8; }
                    input, button { padding: 10px; margin: 5px 0; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; }
                    button { background: #0ea5e9; cursor: pointer; font-weight: bold; border: none; }
                    button:hover { background: #0284c7; }
                    ul { list-style: none; padding: 0; }
                    li { padding: 10px; margin: 5px 0; background: #0f172a; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
                    a { color: #38bdf8; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>🚀 tRive File & Folder Manager</h2>
                    <div>
                        <h3>Create Folder</h3>
                        <form action="/api/folders" method="POST">
                            <input type="text" name="folderName" placeholder="Folder Name" required>
                            <button type="submit">Create Folder</button>
                        </form>
                    </div>
                    <div>
                        <h3>Files & Folders</h3>
                        <ul id="file-list"></ul>
                    </div>
                </div>
                <script>
                    fetch('/api/files')
                        .then(res => res.json())
                        .then(items => {
                            const list = document.getElementById('file-list');
                            items.forEach(item => {
                                const li = document.createElement('li');
                                li.innerHTML = \`<span>\${item.isDir ? '📁' : '📄'} \${item.name}</span>\` +
                                    (item.isDir ? '' : \`<a href="/api/download?file=\${encodeURIComponent(item.name)}">Download</a>\`);
                                list.appendChild(li);
                            });
                        });
                </script>
            </body>
            </html>
        `);
    }
});

app.post('/setup', (req, res) => {
    const { password, jwt, port, apiServer, apiKey } = req.body;
    const config = {
        initialized: true,
        password,
        mustChangePassword: true,
        jwt,
        port: port || 3000,
        apiServer,
        apiKey
    };
    saveConfig(config);
    res.redirect('/');
});

// API to list files/folders
app.get('/api/files', (req, res) => {
    fs.readdir(STORAGE_DIR, { withFileTypes: true }, (err, entries) => {
        if (err) return res.status(500).json({ error: 'Could not list files' });
        const items = entries.map(e => ({ name: e.name, isDir: e.isDirectory() }));
        res.json(items);
    });
});

// API to create folder
app.post('/api/folders', (req, res) => {
    const { folderName } = req.body;
    if (!folderName) return res.status(400).send('Folder name required');
    const targetDir = path.join(STORAGE_DIR, folderName);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    res.redirect('/');
});

// API to download file
app.get('/api/download', (req, res) => {
    const fileName = req.query.file;
    if (!fileName) return res.status(400).send('File name required');
    const filePath = path.join(STORAGE_DIR, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`tRive server running on port ${PORT}`);
});
