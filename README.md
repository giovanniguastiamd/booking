# Compute Resource Booking (GitHub-first)

This repository provides a lightweight system to:

- view resources (servers/clusters/VMs) and status (`free`, `occupied`, `offline`)
- book resources through a GitHub Issue Form
- see who owns a running reservation and until when
- expose access instructions without leaking credentials
- publish a static dashboard on GitHub Pages
- prefill booking start/end automatically per resource (next available window)

## Architecture

- Frontend: `site/` (HTML/CSS/JS)
- Resource data: `data/resources.json`
- Reservations: GitHub Issues with labels (`booking`, `resource:*`, `status:*`)
- Automation:
  - `.github/workflows/booking-triage.yml`: validates conflicts and applies status labels
  - `.github/workflows/free-machine.yml`: processes early release requests and tracks who released
  - `.github/workflows/deploy-pages.yml`: regenerates `reservations.json` and deploys Pages

## Quick Setup

1. Create these labels in the repo:
   - `booking`
   - `release`
   - `status:pending`
   - `status:approved`
   - `status:denied`
   - `status:active`
   - `status:done`
   - `resource:server-a`, `resource:cluster-x`, etc.
2. Update `data/resources.json` with your real resources.
3. In `site/index.html`, set `data-repo="owner/repo"` on `body` (example: `giovanniguastiamd/booking`).
4. Enable GitHub Pages:
   - `Settings -> Pages -> Build and deployment -> Source: GitHub Actions`
5. Check `GITHUB_TOKEN` permissions (defaults usually work unless restricted by org policy):
   - triage workflow: `issues: write`, `contents: read`
   - pages workflow: `issues: read`, `pages: write`, `id-token: write`

## Operating Flow

1. On each resource card, the action button changes behavior:
   - `Book This Machine` when free
   - `Free This Machine` when currently occupied
2. A booking request is validated by `booking-triage` for overlaps on the same resource.
3. If no conflict is found, it sets `status:approved`; otherwise `status:denied`.
4. If `Free This Machine` is used, `free-machine` marks the booking as `status:done`, closes it, and posts an audit comment with the GitHub user who released it.
5. `deploy-pages` reads issues and generates `reservations.json`.
6. The Pages dashboard shows current status, owner, end time, and upcoming reservations.
7. Times are displayed in each viewer's local timezone; booking fields are prefilled in UTC.

## Access Security

- Do not store passwords/API keys in issues or the repository.
- Only store instructions and references to internal vaults (`1Password`, `Vault`, `SSO`).
- Use personal accounts, SSH keys, MFA, and VPN.
