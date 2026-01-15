# Contributing to YASBA

Thanks for your interest in contributing to **YASBA — Yet Another Simple Budgeting Application** 🎉

YASBA is a **portfolio-grade, opinionated project** focused on clarity, determinism, and calm UX.
Contributions are welcome, but the bar for architectural consistency is intentionally high.

This document explains **how to contribute effectively**, and just as importantly, **what is out of scope**.

---

## 🧭 Project Values (Read This First)

Before contributing, please align with these principles:

- 📴 **Offline-first is non-negotiable**
  Local data is the source of truth. Sync is optional and future-facing.
- 🧮 **Deterministic behavior**
  Same inputs must always produce the same outputs.
- 🧱 **Clear boundaries**
  Domain logic, UI, and persistence must not bleed into each other.
- 🧘 **Calm over clever**
  Prefer readable, boring solutions over smart-but-fragile ones.
- 📐 **Explicit decisions**
  If a change alters architecture or invariants, it needs an ADR.

If a proposed change conflicts with these, it’s likely to be declined.

---

## 🗂️ Repository Overview

```text
frontend/    React + TypeScript PWA (offline-first)
backend/     Python backend (tooling now, API later)
assets/      Branding, icons, design assets
scripts/     One-off utilities
docs/        Architecture & setup documentation
adrs/        Architecture Decision Records
```

---

## 🚦 What You Can Contribute

Good contribution candidates:

- Bug fixes
- Test improvements
- Documentation improvements
- Tooling / CI improvements
- Performance or determinism fixes
- Small, well-scoped UX refinements
- Refactors that **reduce complexity**

Please open an issue before starting work on:
- New features
- Architectural changes
- Cross-cutting refactors

---

## 🚫 What Is Out of Scope (For Now)

- New budgeting features without prior discussion
- Sync, auth, or multi-user logic (Phase 2+)
- Major UI framework swaps
- Large dependency additions without justification
- “Rewrite” proposals

This project values **incremental, explainable evolution**.

---

## 🛠️ Development Setup

### Prerequisites
- Git
- Docker
- Node.js (managed via `mise`)
- Python 3.11 (managed via `mise`)
- `pnpm`
- `uv`

> ⚠️ **Windows users:**
> Please read `docs/dev-setup/windows.md` carefully for PowerShell and PATH setup.

### Bootstrap
```bash
mise install
```

Frontend:
```bash
pnpm -C frontend install
pnpm -C frontend build
```

Backend tooling:
```bash
cd backend
uv sync
uv run ruff check .
```

---

## 🧹 Code Quality & Style

### General
- Favor clarity over brevity
- Avoid hidden state
- Name things precisely
- No “magic” side effects

### Frontend
- TypeScript strictness preferred
- No implicit global state
- UI must not own business logic

### Backend
- Formatting & linting via `ruff`
- Static typing via `mypy`
- Tests via `pytest`
- Pure functions preferred for domain logic

### Pre-commit Hooks
This repo uses **fast pre-commit hooks** (formatting, linting only).

Install once:
```bash
pre-commit install
```

> Note: CI is the source of truth.
> Pre-commit hooks are a convenience, not enforcement.

---

## 🧪 Testing Expectations

- New logic should include tests
- Tests must be deterministic
- No reliance on system time, randomness, or global state unless explicitly controlled
- Prefer small, focused tests over large integration blobs

---

## 🧱 Architectural Changes & ADRs

If your change affects:
- data models
- domain invariants
- persistence strategy
- sync/conflict behavior
- public APIs

You **must** add or update an ADR in `/adrs`.

ADRs should explain:
- context
- decision
- alternatives considered
- consequences

---

## 🔀 Git Workflow

- Branch from `main`
- Use **Conventional Commits** (e.g. `fix:`, `feat:`, `docs:`)
- Keep commits focused and reviewable
- Rebase before merging if requested

Example:
```text
feat(domain): add deterministic monthly projection logic
```

---

## 🧑‍⚖️ Review Process

- All changes go through pull requests
- Feedback is expected to be technical and respectful
- Requests for changes are normal and not personal
- Maintainer decision is final (this is a curated portfolio project)

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the **MIT License**, consistent with the rest of the project.

---

## 💬 Questions?

If something is unclear:
- Open an issue
- Or start a discussion

Clarity beats assumptions.

---

Thanks for helping keep **YASBA** calm, correct, and boringly reliable. 🧘‍♂️
