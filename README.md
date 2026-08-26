# hAI.tRive (tDrive)

tDrive - Google-Drive-artige Weboberflaeche fuer dein Telegram-Drive, als Docker Container mit GitHub Actions Build nach GHCR.

## Architektur

```
Browser / Android WebView (APK)
        |
        v
tDrive Frontend (public/) - modern, farbig, animiert
        |
        v
tDrive Backend (server.js) - Express, JWT-Auth
        |
        v
highfishNetwork (externes Docker-Netzwerk)
        |
        v
Telegram-Drive REST API (Port 8550, X-API-Key)
        |
        v
Telegram-Drive Container (siehe hAI.TelegramDrivePortainer)
```

tDrive und der Telegram-Drive-Container muessen im selben externen Docker-Netzwerk
(`highfishNetwork`) laufen, damit sich beide Container per Namen erreichen koennen.

## Features

- Passwort-Login (bcryptjs + JWT)
- Dateien listen, hochladen, herunterladen, loeschen
- Suche, Sortierung, Ordner-Navigation mit Breadcrumbs
- Kontextmenue: Umbenennen, Verschieben, Kopieren, Share-Link
- Speicher-Statistik (Storage Stats)
- Modernes, animiertes, mobile-first UI fuer Android-WebView-Wrapper
- Domain: tdrive.arbeitermili.eu

## Quick Start (Portainer)

1. Portainer UI -> Stacks -> Add stack
2. Als Repository-Stack: GitHub-URL `https://github.com/jbkunama1/hAI.tRive` eintragen
   (Portainer zieht dann automatisch `docker-compose.yml` aus dem Repo)
3. Im Bereich **"Environment variables"** (eigenes Portainer-Feld, NICHT die YAML direkt bearbeiten!)
   die vier Variablen aus der Tabelle unten eintragen
4. Deploy the stack

> Wichtig: Die `docker-compose.yml` referenziert die Werte als `${VAR}`. Diese werden
> ausschliesslich aus dem Portainer-Feld "Environment variables" befuellt. Wenn du
> stattdessen Werte direkt in die YAML schreibst, werden sie bei jedem Redeploy aus
> dem Git-Repo wieder durch die `${VAR}`-Platzhalter ersetzt.

## Environment-Variablen

| Variable | Beschreibung | Beispiel |
| --- | --- | --- |
| `JWT_SECRET` | Langer zufaelliger String fuer Token-Signierung | `openssl rand -hex 32` |
| `PASSWORD_HASH` | bcrypt-Hash deines tDrive-Passworts (inkl. aller `$`-Zeichen) | `$2a$10$....` |
| `TELEGRAM_DRIVE_BASE_URL` | Basis-URL der Telegram-Drive-REST-API | `http://telegram-drive:8550/api/v1` |
| `TELEGRAM_DRIVE_API_KEY` | API-Key aus den Telegram-Drive-Einstellungen | dein Key |

### Passwort-Hash erzeugen

```bash
node -e "require('bcryptjs').hash('DEIN_PASSWORT', 10).then(console.log)"
```

Den kompletten Output (inkl. aller `$`) 1:1 in das Portainer-Feld "Environment variables"
unter `PASSWORD_HASH` eintragen. Kein manuelles Escaping noetig, da es sich um das
native Portainer-ENV-Feld handelt, nicht um eine Bash- oder YAML-Interpolation.

## Netzwerk-Hinweis

`TELEGRAM_DRIVE_BASE_URL` muss auf den tatsaechlichen Container-/Service-Namen deines
Telegram-Drive-Containers im `highfishNetwork` zeigen, z. B.:

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

## CI/CD

- Push auf `main` oder Tag `v*` triggert GitHub Actions
- Image wird gebaut und nach `ghcr.io/jbkunama1/hai.trive` gepusht
- Kein Secret noetig, `GITHUB_TOKEN` reicht fuer GHCR-Push

## Troubleshooting

### Docker-Build schlaegt bei `npm install` fehl (bcrypt)

```
npm error code ETARGET ... oder ... gyp ERR! build error
```

Ursache: Das native `bcrypt`-Paket braucht Build-Tools (`python3`, `make`, `g++`),
die im `node:22-alpine`-Image fehlen. Geloest durch Wechsel auf `bcryptjs`
(reines JavaScript, keine Kompilierung). Falls du einen eigenen Fork pflegst und
den Fehler erneut siehst, pruefe `package.json` auf `"bcryptjs"` statt `"bcrypt"`.

### `npm error notarget No matching version found for multer@^1.4.5`

Ursache: `multer@1.4.5` existiert nicht in der npm-Registry (nur `1.4.5-lts.x` als
Sondertags). Zusaetzlich hat die Multer-1.x-Reihe bekannte DoS-Schwachstellen.
Geloest durch Bump auf `"multer": "^2.1.0"` in `package.json` (API-kompatibel,
keine Codeaenderung in `server.js` noetig).

### Environment-Variablen werden nicht uebernommen (`PASSWORD_HASH=change-me-bcrypt-hash`)

Wenn `docker exec tdrive env | grep PASSWORD_HASH` weiterhin den Platzhalter aus der
`docker-compose.yml` zeigt, obwohl im Portainer-"Environment variables"-Feld ein
echter Wert eingetragen ist:

1. Pruefen, ob die `docker-compose.yml` echte Referenzen wie `PASSWORD_HASH=${PASSWORD_HASH}`
   enthaelt und nicht einen hartkodierten String. Nur `${VAR}`-Syntax wird durch
   Portainers Environment-variables-Feld ersetzt.
2. Pruefen, ob der Stack als **Git repository** oder **Web editor** angelegt ist.
   Bei einem Git-Repository-Stack wird die YAML bei jedem Deploy neu aus GitHub
   gezogen - manuelle Aenderungen direkt im Portainer-YAML-Editor werden dabei
   ignoriert. Die Werte muessen ins separate "Environment variables"-Feld.
3. Nach Aenderungen immer **"Update the stack"** (inkl. Re-pull) ausfuehren, nicht
   nur speichern.

### `ECONNREFUSED` beim Verbindungsversuch zu `TELEGRAM_DRIVE_BASE_URL`

```
Error: connect ECONNREFUSED <ip>:8550
```

Moegliche Ursachen, in Reihenfolge der Wahrscheinlichkeit:

1. Die Telegram-Drive-REST-API bindet nur an `127.0.0.1` innerhalb ihres eigenen
   Containers und ist daher aus anderen Containern nicht erreichbar, selbst wenn
   der Port im Compose gemappt ist.
2. Port `8550` ist im `hAI.TelegramDrivePortainer`-Stack nicht exposed/gemappt.
3. tDrive und Telegram-Drive haengen nicht im selben Docker-Netzwerk
   (`highfishNetwork`).
4. `TELEGRAM_DRIVE_BASE_URL` zeigt auf eine oeffentliche Domain statt auf den
   internen Container-Namen - das funktioniert nur, wenn Port 8550 dort auch
   tatsaechlich per Reverse Proxy/Firewall freigegeben ist.

Diagnose:

```bash
docker network inspect highfishNetwork
docker exec -it tdrive sh
wget -qO- http://telegram-drive:8550/api/v1/health
```

## Naechste Schritte

- Icons `public/icon-192.png` / `public/icon-512.png` ergaenzen
- Reverse Proxy (Caddy/Traefik/Nginx) auf `tdrive.arbeitermili.eu` -> Port 8080
- Android-WebView-Wrapper auf `https://tdrive.arbeitermili.eu` zeigen lassen
