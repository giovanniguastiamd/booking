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
  - `.github/workflows/deploy-pages.yml`: regenerates `reservations.json` and deploys Pages

## Quick Setup

1. Create these labels in the repo:
   - `booking`
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

1. A team member opens a `Booking request` issue (YAML form or Markdown fallback).
2. `booking-triage` checks time overlaps for the same resource.
3. If no conflict is found, it sets `status:approved`; otherwise `status:denied`.
4. `deploy-pages` reads issues and generates `reservations.json`.
5. The Pages dashboard shows current status, owner, end time, and upcoming reservations.
6. Times are displayed in each viewer's local timezone; booking fields are prefilled in UTC.

## Access Security

- Do not store passwords/API keys in issues or the repository.
- Only store instructions and references to internal vaults (`1Password`, `Vault`, `SSO`).
- Use personal accounts, SSH keys, MFA, and VPN.
