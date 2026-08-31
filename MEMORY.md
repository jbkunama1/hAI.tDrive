# hAI.tRive - Projekt Memory

## Aktueller Stand (2026-09-01)

### Repository Status
- **Main Branch**: Commit `9a20fd3` + PR #6 merged
- **Branch**: `jbkunama1-ideal-broccoli` (wird nach Merge gelöscht)
- **PR #6**: "fix: redirect /login and /admin to root + update deps" ✅ merged

### Kern-Funktionalitäten

#### 1. Auth & Setup
- **Plaintext PASSWORD** via ENV (kein bcrypt mehr, vermeidet $-Escaping-Probleme in Portainer)
- **JWT_SECRET** via ENV
- **Setup-Wizard wird übersprungen**, wenn kritische ENVs gesetzt sind (`PASSWORD`, `JWT_SECRET`, `TELEGRAM_DRIVE_API_KEY`, `TELEGRAM_DRIVE_BASE_URL`)

#### 2. Routing (server.js)
- `/` → SPA (public/index.html) mit eingebautem Login-Screen
- `/login` → Redirect zu `/` (fix für weiße Seite)
- `/admin` → Redirect zu `/` (fix für weiße Seite)
- `/api/health` → Healthcheck für Docker (prüft Telegram-Drive)
- `/api/login` → JWT Token Generation
- `/api/*` → Proxy zu Telegram-Drive REST API

#### 3. Docker & Deployment
- **Dockerfile**: Node 22 Alpine, PORT=8080, Healthcheck auf `/api/health`
- **docker-compose.yml**: Externes Network `highfishNetwork`, Env-Vars über `.env` oder Portainer
- **Image**: `ghcr.io/jbkunama1/hai.trive:latest`

#### 4. Frontend (public/)
- `index.html` - Single Page App mit Login-Screen (div `#login-screen`)
- `app.js` - Client-Logik (Token Handling, API-Calls)
- `style.css` - Responsive Design (Mobile-First, Media Queries)
- `manifest.json` - PWA Support

### Wichtige Env-Variablen (Portainer)
```env
JWT_SECRET=your-secret
PASSWORD=your-login-password
TELEGRAM_DRIVE_BASE_URL=http://telegram-drive:8550/api/v1
TELEGRAM_DRIVE_API_KEY=your-api-key
PORT=8080
```

### Bekannte Issues / Gotchas
1. **Weiße Seite nach "Go to Login"**: Behoben durch Redirect `/login` → `/` (PR #6)
2. **Healthcheck 404**: Behoben durch `/api/health` Endpoint
3. **bcrypt $-Escaping**: Gelöst durch Plaintext-PASSWORD
4. **Env-Substitution in Portainer**: `${VAR}` Syntax funktioniert jetzt korrekt

### Nächste Schritte (falls nötig)
- Tests in Portainer-Umgebung validieren
- Optional: Automatisierte Tests (Playwright/Cypress) für Login-Flow
- Monitoring/Logging für Production erweitern

---
*Auto-generiert aus Session-Kontext*