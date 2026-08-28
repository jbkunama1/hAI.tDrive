const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONFIG_FILE = path.join(__dirname, '../config.json');

// Check if critical env vars are set (Portainer/docker scenario)
const HAS_ENV_CONFIG = !!(
    process.env.PASSWORD ||
    process.env.JWT_SECRET ||
    process.env.TELEGRAM_DRIVE_API_KEY
);

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

// Admin Setup & UI Route
app.get('/', (req, res) => {
    const config = loadConfig();
    const needsSetup = !HAS_ENV_CONFIG && !config.initialized;

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
                <title>tRive - Dashboard</title>
                <style>
                    body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 30px; border-radius: 12px; width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-align: center; }
                    h2 { color: #38bdf8; }
                    p { color: #94a3b8; }
                    a { color: #0ea5e9; text-decoration: none; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 tRive is Active</h2>
                    <p>System is fully configured and secured.</p>
                    <p><a href="/admin">Go to Admin Login</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

app.post('/setup', (req, res) => {
    if (HAS_ENV_CONFIG) {
        return res.status(403).send('Setup is disabled when environment variables are provided.');
    }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`tRive server running on port ${PORT}`);
});
