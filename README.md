<div align="center">

<img src="assets/branding/logo.svg" alt="YASBA Logo" width="160" />

# **YASBA**
### *Yet Another Simple Budgeting Application*

**Offline-first • Deterministic • Calm by design**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-Phase%200%20%7C%20Setup-informational)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20pwa-lightgrey)
![Tech](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Python-blueviolet)

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
| **Phase 0** | Repo setup, tooling, branding, CI foundations *(current)* |
| Phase 1 | Offline-only MVP (IndexedDB, envelope budgeting) |
| Phase 2 | Optional backend sync (FastAPI + PostgreSQL) |
| Phase 3 | Multi-user sharing & collaboration |

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
cd yasba
mise install
```

Frontend:
```bash
pnpm -C frontend install
pnpm -C frontend build
```

Backend tooling check:
```bash
cd backend
uv sync
uv run ruff check .
```

---

## 🎨 Branding & Design

- Logo source of truth: `assets/branding/logo.svg`
- Generated app icons: `assets/branding/icons/`
- Regeneration script: `scripts/generate_icons.py`
- Static branding preview: `docs/brand/preview/`

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
└── ...
```

This keeps architectural intent explicit and reviewable.

---

## 🤝 Contributing

This is currently a **solo, portfolio-driven project**, but contributions and discussions are welcome.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines (to be added).

---

## 📜 License

Distributed under the **MIT License**.
See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**YASBA** — budgeting without surprises.

</div>
