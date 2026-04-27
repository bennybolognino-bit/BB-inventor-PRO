# NEXT STEPS - BB Inventor PRO

## Stato attuale
Il progetto e` in stato funzionante.

### Funziona
- App Electron avviabile
- Installer Windows generato correttamente
- Splash iniziale dell'app
- Welcome page installer personalizzata
- Database server condiviso tramite `server-local-db.json`
- Accesso remoto via browser al database del server
- Sincronizzazione remoto -> server
- Sincronizzazione server -> remoto
- Tab `Diagnostica` con lettura log
- Backup del progetto su GitHub completato
- `dist/` esclusa dal versionamento Git

## File principali
- `BB_Inventor_PRO.html`
- `main.js`
- `preload.js`
- `electron-bootstrap.js`
- `server-db.js`
- `logger.js`
- `electron-builder.yml`

## Dati e percorsi utili
### Database server condiviso
Percorso tipico:
`%APPDATA%\bb-inventor-pro\server-local-db.json`

### Log applicativo
Percorso tipico:
`%APPDATA%\bb-inventor-pro\logs\app.log`

## Comandi utili
### Avvio app in sviluppo
`npm.cmd run electron`

### Rigenerare installer Windows
`Get-Process | Where-Object { $_.ProcessName -like "*BB Inventor*" -or $_.ProcessName -like "electron*" } | Stop-Process -Force`
`Remove-Item ".\dist" -Recurse -Force -ErrorAction SilentlyContinue`
`npm.cmd run dist:win`

### Backup su GitHub
`git status`
`git add .`
`git commit -m "Messaggio commit"`
`git pull --rebase origin main`
`git push origin main`

## Nota importante
La cartella `dist/` non va caricata su GitHub.
Gli installer `.exe` vanno distribuiti fuori dal repository oppure come release asset.

## Se si riprende il lavoro
Controllare prima:
1. Avvio app con `npm.cmd run electron`
2. Avvio server remoto
3. Verifica accesso browser remoto
4. Verifica tab `Diagnostica`
5. Verifica percorso `server-local-db.json`

## Possibili prossimi sviluppi
- Migliorare UI/UX della tab Diagnostica
- Aggiungere export log dalla Diagnostica
- Aggiungere filtri log avanzati
- Migliorare branding installer
- Aggiungere nuove funzioni inventario
