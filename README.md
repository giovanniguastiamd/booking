# Booking risorse di calcolo (GitHub-first)

Questo repository implementa un sistema semplice per:

- vedere risorse (server/cluster/VM) e stato (`free`, `occupied`, `offline`)
- prenotare tramite GitHub Issue Form
- vedere owner e fine prenotazione
- mostrare istruzioni di accesso senza esporre credenziali
- pubblicare una dashboard statica su GitHub Pages

## Architettura

- Frontend: `site/` (HTML/CSS/JS)
- Dati risorse: `data/resources.json`
- Prenotazioni: GitHub Issues con label (`booking`, `resource:*`, `status:*`)
- Automazione:
  - `.github/workflows/booking-triage.yml`: valida conflitti e applica status
  - `.github/workflows/deploy-pages.yml`: rigenera `reservations.json` e deploya Pages

## Setup rapido

1. Crea labels nel repo:
   - `booking`
   - `status:pending`
   - `status:approved`
   - `status:denied`
   - `status:active`
   - `status:done`
   - `resource:server-a`, `resource:cluster-x`, ecc.
2. Aggiorna `data/resources.json` con le tue risorse reali.
3. In `site/index.html`, imposta sul `body`:
   - `data-repo="owner/repo"`
   - `data-git-host="https://<tuo-github-enterprise-host>"` (opzionale, default `https://github.com`)
4. Abilita GitHub Pages:
   - `Settings -> Pages -> Build and deployment -> Source: GitHub Actions`
5. Verifica permessi `GITHUB_TOKEN` (default va bene se non bloccato da policy org):
   - workflow triage: `issues: write`, `contents: read`
   - workflow pages: `issues: read`, `pages: write`, `id-token: write`

## Flusso operativo

1. Team apre una issue con template `Booking request`.
2. Il workflow `booking-triage` controlla sovrapposizioni temporali sulla stessa risorsa.
3. Se non ci sono conflitti: label `status:approved`; altrimenti `status:denied`.
4. Il workflow `deploy-pages` legge le issue e genera `reservations.json`.
5. La dashboard Pages mostra stato corrente, owner, scadenza e prossime prenotazioni.

## Sicurezza accessi

- Non salvare password/API key in issue o repo.
- Metti solo istruzioni e riferimenti a vault interni (`1Password`, `Vault`, `SSO`).
- Usa account personali + SSH keys + MFA + VPN.
