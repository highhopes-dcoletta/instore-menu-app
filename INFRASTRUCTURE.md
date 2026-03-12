# High Hopes Menu — Infrastructure Guide

**Last updated:** 2026-03-11 · **Version:** 1.0

---

## Overview

The High Hopes Menu is a Vue 3 kiosk application for an in-store dispensary touchscreen. It replaces the previous Softr-hosted menu at menu.highhopesma.com.

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   iPad /     │     │  VPS  104.236.29.111                            │
│   Browser    │────▶│                                                  │
│              │     │  ┌───────────┐    ┌────────────┐                │
│  Vue 3 SPA   │     │  │  Nginx    │───▶│  Flask     │                │
│  (Vite)      │     │  │  :80/:443 │    │  (Waitress)│                │
│              │     │  │           │    │  :5001 prod│                │
│              │     │  │  static   │    │  :5002 stage│               │
│              │     │  │  files    │    │            │                │
│              │     │  └───────────┘    └─────┬──────┘                │
└──────┬───────┘     │                         │                       │
       │             │                    analytics.db (SQLite)        │
       │             └──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Dutchie API  │  (GraphQL, called directly from browser)
└──────────────┘
```

---

## Server

**Host:** 104.236.29.111 (DigitalOcean VPS, Ubuntu)
**SSH:** `root@104.236.29.111` (key-based auth via macOS keychain)
**Timezone:** America/New_York

### Domains

| Domain | Purpose | SSL |
|--------|---------|-----|
| `menu2.highhopesma.com` | Production | Let's Encrypt (auto-renew via Certbot) |
| `menu2-stage.highhopesma.com` | Staging | Let's Encrypt (auto-renew via Certbot) |

Both domains point to the same VPS. Nginx virtual hosts route to different document roots and Flask ports.

---

## Frontend

**Stack:** Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS + Vue I18n

The frontend is a single-page application built locally and rsynced to the server. Nginx serves the static files with SPA history-mode fallback (`try_files $uri $uri/ /index.html`).

### Product data

Products are fetched directly from the **Dutchie GraphQL API** by the browser — there is no backend proxy. This is intentional (matches the previous Softr setup). Credentials are embedded in the frontend build via environment variables.

- Endpoint: `https://plus.dutchie.com/plus/2021-07/graphql`
- Refresh interval: 60 seconds (background)
- Fallback: localStorage cache if Dutchie is unreachable

### Environment variables

Stored in `frontend/.env.local` (git-ignored). Template at `frontend/.env.example`.

| Variable | Purpose |
|----------|---------|
| `VITE_DUTCHIE_BEARER_TOKEN` | Dutchie API auth token |
| `VITE_DUTCHIE_RETAILER_ID` | Dutchie retailer UUID |

### Build

```bash
cd frontend && npm run build   # outputs to frontend/dist/
```

Vite injects `__APP_VERSION__` at build time (git commit count + short SHA), displayed as a version badge on every page and appended to window titles.

---

## Backend

**Stack:** Flask 3 + Waitress (WSGI) + SQLite

The backend handles session management, bundle/deal CRUD, and analytics event logging. It does **not** serve product data.

### API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/session` | Create a kiosk session |
| GET | `/api/session/<id>` | Get session details |
| DELETE | `/api/session/<id>` | End a session |
| GET | `/api/sessions` | List active sessions (budtender view) |
| GET/POST/PUT/DELETE | `/api/bundles` | Bundle (deal) CRUD |
| POST | `/api/event` | Log an analytics event |
| GET | `/api/analytics` | Query analytics data |

### Session management

Sessions are stored **in-memory** (Python dict). They are cleared on service restart, which is acceptable for the kiosk use case (sessions last 2–15 minutes). If persistence were ever needed, this would require Redis or similar.

### Database

SQLite at `backend/analytics.db` with two tables:
- **events** — user interaction tracking (add_to_cart, order_submitted, session_abandoned, etc.)
- **bundles** — deal/promotion definitions with matching criteria, pricing, and scheduling

### Environment variables

Stored in `backend/.env` (git-ignored).

| Variable | Purpose |
|----------|---------|
| `SESSION_TIMEOUT_MINUTES` | Session expiry (default: 15) |
| `FLASK_PORT` | Listen port (prod: 5001, stage: 5002) |
| `PROD_DB_PATH` | Path to prod database (staging only, for promoting bundles) |

---

## Nginx

Two virtual hosts on the same server:

| Config file | Domain | Document root | Flask proxy |
|-------------|--------|---------------|-------------|
| `infra/nginx.conf` | `menu2.highhopesma.com` | `/var/www/highhopes-menu` | `127.0.0.1:5001` |
| `infra/nginx-stage.conf` | `menu2-stage.highhopesma.com` | `/var/www/highhopes-menu-stage` | `127.0.0.1:5002` |

Both redirect HTTP→HTTPS and use Let's Encrypt certificates. `/api/` requests are reverse-proxied to Flask; everything else serves static files with SPA fallback.

---

## Systemd services

| Unit file | Service | Port |
|-----------|---------|------|
| `infra/highhopes-menu.service` | Production Flask/Waitress | 5001 |
| `infra/highhopes-menu-stage.service` | Staging Flask/Waitress | 5002 |

Both run as root, auto-restart on failure (5s delay), and start at boot (multi-user.target).

---

## Deployment

### Production (`bash deploy.sh`)

**Requires `git push` first** — the server pulls from GitHub.

1. Build frontend locally (`vite build`)
2. SSH to VPS, pull latest from GitHub
3. Install Python dependencies in venv
4. Rsync `frontend/dist/` → `/var/www/highhopes-menu/`
5. Verify index.html hash integrity
6. Copy `backend/.env` to server
7. Restart systemd service
8. Wait for API health check on port 5001

### Staging (`bash deploy-stage.sh`)

**No git push required** — rsyncs local source directly.

1. Build frontend locally
2. Rsync backend + infra source to server (excludes venv, __pycache__)
3. Install Python dependencies in venv
4. Rsync `frontend/dist/` → `/var/www/highhopes-menu-stage/`
5. Verify index.html hash integrity
6. Copy `.env`, restart service
7. Wait for API health check on port 5002
8. Provision SSL via Certbot (if needed)
9. **Run e2e tests against staging — deployment fails if tests don't pass**

---

## Monitoring

There are two independent monitoring systems for redundancy.

### 1. GitHub Actions E2E tests

**Workflow:** `.github/workflows/e2e-monitor.yml`

Runs a full Playwright e2e test suite (`monitor/e2e.spec.js`) against production every 15 minutes. The schedule trigger is supplemented by an **external cron service** (cron-job.org) calling the `workflow_dispatch` endpoint, because GitHub's built-in cron scheduler is unreliable for free-tier repos.

On failure:
- Sends a PagerTree alert (critical severity)
- Uploads failure screenshots as GitHub artifacts (7-day retention)

**E2E test coverage** (~50 tests):
- Home page and navigation
- Guided questionnaire flow
- Filtering and sorting
- Product modal interactions
- Cart management (add, remove, clear)
- Budtender view
- Cart share page
- Bundle editor CRUD + customer-facing integration
- SSL certificate validation

### 2. Shell health check (`monitor.sh`)

A lightweight bash script that checks:
1. Static site returns 200
2. `/api/sessions` returns valid JSON
3. Session create/read/delete lifecycle works
4. SSL certificate has >14 days until expiry

Designed to run via server-side cron (`*/5 * * * *`). Alerts via PagerTree on failure.

---

## External services

| Service | Purpose | Credentials |
|---------|---------|-------------|
| **Dutchie GraphQL API** | Product catalog | `VITE_DUTCHIE_BEARER_TOKEN`, `VITE_DUTCHIE_RETAILER_ID` |
| **PagerTree** | Incident alerting | `PAGERTREE_INTEGRATION_URL` (GitHub secret + server env var) |
| **GitHub** | Source code, CI/CD | SSH key (deploy), PAT (cron trigger) |
| **cron-job.org** | Reliable 15-min e2e trigger | GitHub PAT with Actions write scope |
| **Let's Encrypt** | SSL certificates | Managed by Certbot on VPS |

---

## Directory layout on VPS

```
/home/highhopes/
├── highhopes-menu/              # Production source (git clone)
│   ├── backend/
│   │   ├── app.py
│   │   ├── analytics.db
│   │   ├── .env
│   │   └── venv/
│   └── infra/
│
├── highhopes-menu-stage/        # Staging source (rsync, no git)
│   ├── backend/
│   │   ├── app.py
│   │   ├── analytics.db
│   │   ├── .env
│   │   └── venv/
│   └── infra/

/var/www/
├── highhopes-menu/              # Prod Nginx document root
│   └── (frontend dist files)
├── highhopes-menu-stage/        # Stage Nginx document root
│   └── (frontend dist files)

/etc/systemd/system/
├── highhopes-menu.service       # Prod Flask
├── highhopes-menu-stage.service # Stage Flask

/etc/nginx/sites-enabled/
├── highhopes-menu               # Prod vhost
├── highhopes-menu-stage         # Stage vhost

/etc/letsencrypt/live/
├── menu2.highhopesma.com/
├── menu2-stage.highhopesma.com/
```

---

## Local development

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py                    # Flask on :5001

# Frontend
cd frontend
cp .env.example .env.local       # fill in Dutchie credentials
npm install
npm run dev                      # Vite on :5173, proxies /api → :5001

# Tests
cd frontend && npm test          # Vitest unit tests (266 tests)
cd monitor && npm test           # Playwright e2e tests (against BASE_URL)
```
