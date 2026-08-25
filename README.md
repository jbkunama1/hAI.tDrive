# hAI.tDrive

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
Telegram-Drive REST API (Port 8550, X-API-Key)
        |
        v
Telegram-Drive Container (siehe hAI.TelegramDrivePortainer)
```

## Features

- Passwort-Login (bcrypt + JWT)
- Dateien listen, hochladen, herunterladen, loeschen
- Suche, Sortierung, Ordner-Navigation mit Breadcrumbs
- Kontextmenue: Umbenennen, Verschieben, Kopieren, Share-Link
- Speicher-Statistik (Storage Stats)
- Modernes, animiertes, mobile-first UI fuer Android-WebView-Wrapper
- Domain: tdrive.arbeitermili.eu

## Quick Start (Portainer)

1. Portainer UI -> Stacks -> Add stack
2. `docker-compose.yml` Inhalt einfuegen
3. Environment-Variablen anpassen (siehe unten)
4. Deploy the stack

## Environment-Variablen

| Variable | Beschreibung |
| --- | --- |
| `JWT_SECRET` | Langer zufaelliger String fuer Token-Signierung |
| `PASSWORD_HASH` | bcrypt-Hash deines tDrive-Passworts |
| `TELEGRAM_DRIVE_BASE_URL` | z.B. `http://telegram-drive:8550/api/v1` |
| `TELEGRAM_DRIVE_API_KEY` | API-Key aus den Telegram-Drive-Einstellungen |
| `PORT` | Standard: 8080 |

### Passwort-Hash erzeugen

```bash
node -e "require('bcrypt').hash('DEIN_PASSWORT', 10).then(console.log)"
```

## Netzwerk-Hinweis

Damit `TELEGRAM_DRIVE_BASE_URL=http://telegram-drive:8550/api/v1` funktioniert,
muessen dieser Container und der Telegram-Drive-Container (aus `hAI.TelegramDrivePortainer`)
im selben Docker-Netzwerk laufen. Alternativ die volle Server-IP + Port 8550 verwenden,
wenn Port 8550 im Telegram-Drive-Stack nach aussen gemappt ist.

## CI/CD

- Push auf `main` oder Tag `v*` triggert GitHub Actions
- Image wird gebaut und nach `ghcr.io/jbkunama1/hai.tdrive` gepusht
- Kein Secret noetig, `GITHUB_TOKEN` reicht fuer GHCR-Push

## Naechste Schritte

- Icons `public/icon-192.png` / `public/icon-512.png` ergaenzen
- Reverse Proxy (Caddy/Traefik/Nginx) auf `tdrive.arbeitermili.eu` -> Port 8080
- Android-WebView-Wrapper auf `https://tdrive.arbeitermili.eu` zeigen lassen
