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


## Operating Flow

Go to the page https://giovanniguastiamd.github.io/booking/ 

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
