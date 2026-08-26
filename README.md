<div align="center">

<img src="logo-trive.png" alt="tRive Logo" width="140" />

# 🚀 tRive

### Dein farbenfrohes, modernes Cloud-Drive-Frontend fuer Telegram-Drive

[![Build and Push to GHCR](https://github.com/jbkunama1/hAI.tRive/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/jbkunama1/hAI.tRive/actions/workflows/build-and-push.yml)
[![Secret Scan](https://github.com/jbkunama1/hAI.tRive/actions/workflows/truffelhog.yml/badge.svg)](https://github.com/jbkunama1/hAI.tRive/actions/workflows/truffelhog.yml)
![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Fjbkunama1%2Fhai.trive-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blueviolet)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Portainer](https://img.shields.io/badge/deploy-Portainer-13BEF9?logo=portainer&logoColor=white)
![Status](https://img.shields.io/badge/status-active-success)

**🌐 Live-Domain:** [tdrive.arbeitermili.eu](https://tdrive.arbeitermili.eu)

</div>

---

## 📖 Was ist tRive?

**tRive** ist dein eigenes, GDrive-artiges Web-Frontend fuer **tDrive**
([caamer20/Telegram-Drive](https://github.com/caamer20/Telegram-Drive)) - deinen
Telegram-basierten Cloud-Speicher. tRive ist die App, **tDrive** ist der zugrunde
liegende Service, mit dem tRive ueber dessen REST-API spricht. 🎨✨

> 💡 **tRive** = deine App (dieses Repo)
> 📦 **tDrive** = der Telegram-Drive-Service, auf den zugegriffen wird

---

## 🏗️ Architektur

```
📱 Browser / Android WebView (APK)
        │
        ▼
🎨 tRive Frontend (public/) — modern, farbig, animiert
        │
        ▼
⚙️  tRive Backend (server.js) — Express, JWT-Auth
        │
        ▼
🔗 highfishNetwork (externes Docker-Netzwerk)
        │
        ▼
📡 tDrive REST API (Port 8550, X-API-Key)
        │
        ▼
☁️  Telegram-Drive Container (siehe hAI.TelegramDrivePortainer)
```

tRive und der tDrive-Container muessen im selben externen Docker-Netzwerk
(`highfishNetwork`) laufen, damit sich beide Container per Namen erreichen koennen. 🔌

---

## ✨ Features

| | Feature |
|---|---|
| 🔐 | Passwort-Login (bcryptjs + JWT) |
| 📁 | Dateien listen, hochladen, herunterladen, loeschen |
| 🔍 | Suche, Sortierung, Ordner-Navigation mit Breadcrumbs |
| 🖱️ | Kontextmenue: Umbenennen, Verschieben, Kopieren, Share-Link |
| 📊 | Speicher-Statistik (Storage Stats) |
| 🎨 | Modernes, animiertes, mobile-first UI fuer Android-WebView-Wrapper |
| 🌍 | Domain: `tdrive.arbeitermili.eu` |

---

## 🚀 Quick Start (Portainer)

1. 🖥️ Portainer UI → **Stacks** → **Add stack**
2. 📦 Als **Repository-Stack**: GitHub-URL `https://github.com/jbkunama1/hAI.tRive` eintragen
   (Portainer zieht dann automatisch `docker-compose.yml` aus dem Repo)
3. ⚙️ Im Bereich **"Environment variables"** (eigenes Portainer-Feld, **NICHT** die YAML direkt bearbeiten!)
   die vier Variablen aus der Tabelle unten eintragen
4. ✅ **Deploy the stack**

> ⚠️ **Wichtig:** Die `docker-compose.yml` referenziert die Werte als `${VAR}`. Diese werden
> ausschliesslich aus dem Portainer-Feld "Environment variables" befuellt. Wenn du
> stattdessen Werte direkt in die YAML schreibst, werden sie bei jedem Redeploy aus
> dem Git-Repo wieder durch die `${VAR}`-Platzhalter ersetzt.

---

## 🔑 Environment-Variablen

| Variable | Beschreibung | Beispiel |
| --- | --- | --- |
| 🔒 `JWT_SECRET` | Langer zufaelliger String fuer Token-Signierung | `openssl rand -hex 32` |
| 🔑 `PASSWORD_HASH` | bcrypt-Hash deines tRive-Passworts (inkl. aller `$`-Zeichen) | `$2a$10$....` |
| 📡 `TELEGRAM_DRIVE_BASE_URL` | Basis-URL der tDrive-REST-API | `http://telegram-drive:8550/api/v1` |
| 🗝️ `TELEGRAM_DRIVE_API_KEY` | API-Key aus den tDrive-Einstellungen | dein Key |

### 🧮 Passwort-Hash erzeugen

```bash
node -e "require('bcryptjs').hash('DEIN_PASSWORT', 10).then(console.log)"
```

Den kompletten Output (inkl. aller `$`) 1:1 in das Portainer-Feld "Environment variables"
unter `PASSWORD_HASH` eintragen. Kein manuelles Escaping noetig, da es sich um das
native Portainer-ENV-Feld handelt, nicht um eine Bash- oder YAML-Interpolation.

---

## 🔌 Netzwerk-Hinweis

`TELEGRAM_DRIVE_BASE_URL` muss auf den tatsaechlichen Container-/Service-Namen deines
tDrive-Containers im `highfishNetwork` zeigen, z. B.:

```
TELEGRAM_DRIVE_BASE_URL=http://telegram-drive:8550/api/v1
```

Pruefen, welcher Name korrekt ist:

```bash
docker network inspect highfishNetwork
docker ps --format "{{.Names}}"
```

Falls `highfishNetwork` noch nicht existiert, muss es vorher angelegt werden
(z. B. durch den `hAI.TelegramDrivePortainer`-Stack) oder manuell:

```bash
docker network create highfishNetwork
```

---

## 🔄 CI/CD

- 🔁 Push auf `main` oder Tag `v*` triggert GitHub Actions
- 🐳 Image wird gebaut und nach `ghcr.io/jbkunama1/hai.trive` gepusht
- 🔐 Kein Secret noetig, `GITHUB_TOKEN` reicht fuer GHCR-Push
- 🛡️ TruffleHog scannt bei jedem Push nach versehentlich committeten Secrets

---

## 🩺 Troubleshooting

<details>
<summary>❌ Docker-Build schlaegt bei <code>npm install</code> fehl (bcrypt)</summary>

```
npm error code ETARGET ... oder ... gyp ERR! build error
```

**Ursache:** Das native `bcrypt`-Paket braucht Build-Tools (`python3`, `make`, `g++`),
die im `node:22-alpine`-Image fehlen.

**Fix:** Wechsel auf `bcryptjs` (reines JavaScript, keine Kompilierung). Pruefe
`package.json` auf `"bcryptjs"` statt `"bcrypt"`.
</details>

<details>
<summary>❌ <code>npm error notarget No matching version found for multer@^1.4.5</code></summary>

**Ursache:** `multer@1.4.5` existiert nicht in der npm-Registry (nur `1.4.5-lts.x`
als Sondertags). Zusaetzlich hat Multer 1.x bekannte DoS-Schwachstellen.

**Fix:** Bump auf `"multer": "^2.1.0"` in `package.json` (API-kompatibel, keine
Codeaenderung in `server.js` noetig).
</details>

<details>
<summary>⚠️ Environment-Variablen werden nicht uebernommen (<code>PASSWORD_HASH=change-me-bcrypt-hash</code>)</summary>

Wenn `docker exec tdrive env | grep PASSWORD_HASH` weiterhin den Platzhalter aus der
`docker-compose.yml` zeigt, obwohl im Portainer-"Environment variables"-Feld ein
echter Wert eingetragen ist:

1. ✅ Pruefen, ob die `docker-compose.yml` echte Referenzen wie `PASSWORD_HASH=${PASSWORD_HASH}`
   enthaelt und nicht einen hartkodierten String.
2. ✅ Pruefen, ob der Stack als **Git repository** oder **Web editor** angelegt ist.
   Bei einem Git-Repository-Stack wird die YAML bei jedem Deploy neu aus GitHub
   gezogen - manuelle Aenderungen direkt im Portainer-YAML-Editor werden ignoriert.
3. ✅ Nach Aenderungen immer **"Update the stack"** (inkl. Re-pull) ausfuehren.
</details>

<details>
<summary>🔌 <code>ECONNREFUSED</code> beim Verbindungsversuch zu <code>TELEGRAM_DRIVE_BASE_URL</code></summary>

```
Error: connect ECONNREFUSED <ip>:8550
```

Moegliche Ursachen, in Reihenfolge der Wahrscheinlichkeit:

1. 🔒 Die tDrive-REST-API bindet nur an `127.0.0.1` innerhalb ihres eigenen
   Containers und ist daher aus anderen Containern nicht erreichbar.
2. 🚪 Port `8550` ist im `hAI.TelegramDrivePortainer`-Stack nicht exposed/gemappt.
3. 🔗 tRive und tDrive haengen nicht im selben Docker-Netzwerk (`highfishNetwork`).
4. 🌐 `TELEGRAM_DRIVE_BASE_URL` zeigt auf eine oeffentliche Domain statt auf den
   internen Container-Namen.

**Diagnose:**

```bash
docker network inspect highfishNetwork
docker exec -it tdrive sh
wget -qO- http://telegram-drive:8550/api/v1/health
```
</details>

---

## 🗺️ Naechste Schritte

- 🖼️ Icons `public/icon-192.png` / `public/icon-512.png` ergaenzen
- 🌐 Reverse Proxy (Caddy/Traefik/Nginx) auf `tdrive.arbeitermili.eu` → Port 8080
- 📱 Android-WebView-Wrapper auf `https://tdrive.arbeitermili.eu` zeigen lassen

---

<div align="center">

**Made with 💜 by [jbkunama1](https://github.com/jbkunama1)**

</div>
