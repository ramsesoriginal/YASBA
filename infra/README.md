# Infra / Local Development (Docker)

This directory contains **local development infrastructure only**.

Phase 0 / Phase 1 intentionally run **frontend only**.
Backend and database services will be added in later phases.

---

## Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- No Node.js installation required on the host

---

## Start frontend dev server

First run (or after dependency changes):

```bash
docker compose -f infra/compose.yml up --build
```

Then open:

- http://localhost:5173

---

## Stop services

```bash
docker compose -f infra/compose.yml down
```

---

## Clean reset (if dependencies get weird)

This removes container volumes (including `node_modules`) and rebuilds from scratch:

```bash
docker compose -f infra/compose.yml down -v
docker compose -f infra/compose.yml up --build
```

---

## How this setup works

- The frontend source (`/frontend`) is **mounted from the host**
- `node_modules` live in a **Docker volume**, not on the host
- `pnpm` is provided via **Corepack** inside the container
- File watching uses **polling** for reliability on Windows/macOS

This avoids:
- host/container dependency conflicts
- Windows filesystem permission issues
- “works on my machine” Node version drift

---

## Notes for Windows users

- File watching uses polling (`CHOKIDAR_USEPOLLING`, `WATCHPACK_POLLING`)
- Expect slightly higher CPU usage while the dev server is running
- If hot reload stops working, try a clean reset (`down -v`)

---

## Explicit non-goals (by design)

- No backend service
- No database
- No production Docker images
- No deployment configuration

These will be added incrementally in later phases.
