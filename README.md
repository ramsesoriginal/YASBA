<div align="center">

<img src="assets/branding/logo.svg" alt="YASBA Logo" width="160" />

# **YASBA**
### *Yet Another Simple Budgeting Application*

**Offline-first • Deterministic • Calm by design**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-Phase%200%20%7C%20Setup-informational)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20pwa-lightgrey)
![Tech](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Python-blueviolet)
![CI](https://github.com/ramsesoriginal/YASBA/actions/workflows/ci.yml/badge.svg)

</div>

---

## ✨ What is YASBA?

**YASBA** is a **personal budgeting application** built around one core idea:

> Budgeting should be **predictable, explainable, and non-stressful**.

It follows **envelope budgeting principles**, is **offline-first by default**, and treats financial calculations as **deterministic, testable domain logic** — not UI side effects.

This repository is intentionally structured as a **portfolio-grade monorepo**, showcasing clean architecture, tooling discipline, and incremental delivery.

---

## 🧭 Project Philosophy

- 📴 **Offline-first** — local data is the source of truth
- 🧮 **Deterministic math** — same inputs → same outputs
- 🧱 **Clear boundaries** — domain logic ≠ UI ≠ persistence
- 🧘 **Calm UX** — neutral colors, readable typography, no visual stress
- 🛠️ **Boringly reliable tooling** — clarity over cleverness

---

## 🗂️ Repository Structure

```text
.
├── frontend/        # React + TypeScript PWA (offline-first)
├── backend/         # Python backend (Phase 2+, currently tooling only)
├── infra/           # Docker / CI / deployment scaffolding
├── assets/
│   └── branding/    # Logo, icons, design assets
├── scripts/         # One-off utilities (e.g. favicon generation)
├── docs/            # Architecture, setup guides, design notes
├── adrs/            # Architecture Decision Records
└── README.md
```

---

## 🚦 Project Status

| Phase | Description |
|------:|-------------|
| **Phase 0** | Repo setup, tooling, branding, CI foundations (done) |
| **Phase 1** | Offline-only MVP (IndexedDB, envelope budgeting) *(current)* |
| Phase 2 | Optional backend sync (FastAPI + PostgreSQL) |
| Phase 3 | Multi-user sharing & collaboration |

**Phase 1 (offline-only MVP) is in progress.**
Phase 0 (repo scaffolding, CI, tooling, docs baseline) is complete and tagged as `v0.1.0`.

### Phase 1 roadmap (vertical slices)

- ✅ Slice 1 — Minimal usable month (categories + income/expense + deterministic balances + IndexedDB)
- ✅ Slice 2 — Budget assignment + rollover + plan future months
- ⏭️ Slice 3 — Transaction workflow polish (append-only edits/corrections)
- Slice 4 — Category management (subcategories, rename, archive, ordering)
- Slice 5 — Reports (spending per category/month)
- Slice 6 — Import/Export JSON
- Slice 7 — MVP hardening (a11y, UX polish, docs, release v0.2.0)

### What works right now (Slice 2)

- Offline-only persistence via **IndexedDB** (append-only records)
- Deterministic month projection from immutable records
- Minimal Month screen:
  - create categories
  - add income (uncategorized inflow → “Ready to Assign”)
  - add expenses (categorized outflows)
  - **assign budget to categories per month** (Budgeted)
  - **rollover**: previous month Available carries into the next month
  - plan future months via the month selector
  - refresh the page and data persists

### What is explicitly out of scope (Phase 1)

- accounts, auth, sync, backend
- multi-user/sharing
- recurring transactions, debt, goals (scheduled later if ever)

### Budgeting semantics (current)

For a given month + category:

- **Budgeted** = sum of `BudgetAssigned` records in that month/category
- **Activity** = sum of categorized transactions in that month/category
- **Rollover** = previous month **Available** for that category
- **Available** = Rollover + Budgeted + Activity

“Ready to Assign” is currently:

- **Ready to Assign** = uncategorized inflows in the selected month − total Budgeted in the selected month


---

## 🧰 Tech Stack

**Frontend**
- ⚛️ React + TypeScript
- 📦 Vite
- 🗄️ IndexedDB (offline persistence)
- 🎨 Minimal CSS (no heavy UI frameworks)

**Backend (later phases)**
- 🐍 Python 3.11
- ⚡ FastAPI
- 🐘 PostgreSQL

**Tooling**
- 🔧 `mise` — runtime version management
- 📦 `pnpm` — frontend package manager
- 🐍 `uv` — Python dependency & env management
- 🧹 `ruff`, `mypy`, `pytest` — backend quality
- 🤖 GitHub Actions — CI

---

## 🚀 Getting Started (Phase 0)

### Prerequisites
- Git
- Docker
- Node.js (via `mise`)
- Python 3.11 (via `mise`)
- `pnpm`
- `uv`

> ⚠️ **Windows users:**
> Please see [`docs/dev-setup/windows.md`](docs/dev-setup/windows.md) for important PATH and PowerShell notes.

### Clone & bootstrap

```bash
git clone https://github.com/ramsesoriginal/YASBA.git
cd YASBA
mise install
```

Build Frontend:
```bash
pnpm -C frontend install
pnpm -C frontend build
```

Run frontend:
```bash
pnpm -C frontend dev
```

Test frontend:
```bash
pnpm -C frontend test
```

Backend tooling check:
```bash
cd backend
uv sync
uv run ruff check .
```

### Fast path (Docker)

```bash
docker compose -f infra/compose.yml up --build
```

Then open http://localhost:5173
More details: [`infra/README.md`](infra/README.md)

---

## 🎨 Branding & Design

- Logo source of truth: `assets/branding/logo.svg`
- Generated app icons: `assets/branding/icons/`
- Regeneration script: `scripts/generate_icons.py`
- Static branding preview: `docs/branding/styleguide.html` (open in browser)

Design intent:
> *Calm, trustworthy, editorial, and boringly reliable.*

Color and typography choices deliberately avoid visual noise, red/green stress cues, and cognitive overload.

---

## 📐 Architecture Decisions

All non-trivial technical decisions are documented as **ADRs**:

```text
adrs/
├── 0001-offline-first.md
├── 0002-deterministic-domain-model.md
├── ...
docs/
└── architecture/
    └── domain-engine.md
```

This keeps architectural intent explicit and reviewable.

YASBA follows two binding principles:

- **Offline-first**: local data is the source of truth.
- **Deterministic domain model**: the same inputs produce the same outputs; domain logic is pure and testable.

Persistence stores an append-only log of domain records in IndexedDB. UI renders month views by projecting those records into a `MonthSnapshot`.


---

## 🤝 Contributing

This is currently a **solo, portfolio-driven project**, but contributions and discussions are welcome.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

---

## 📜 License

Distributed under the **MIT License**.
See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**YASBA** — budgeting without surprises.

</div>
