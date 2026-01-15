# Windows Development Setup (YASBA)

This document describes the **supported and tested Windows development setup**
for **YASBA - Yet Another Simple Budgeting Application**.

It exists because **Windows PATH resolution + Node version managers** can behave
non-intuitively, and we want deterministic, boring behavior.

If something here feels “over-explicit”, that is intentional.

---

## Supported Environment

- **OS:** Windows 11
- **Shell:** PowerShell 7 (`pwsh`) **required**
- **Node.js:** Managed via `mise`
- **Python:** 3.11.x (managed via `mise`)
- **Package managers:**
  - `pnpm` (frontend)
  - `uv` (backend)
- **Container runtime:** Docker Desktop

> Windows PowerShell 5.1 (`powershell.exe`) is **not supported**.

---

## Critical Rules (Read This First)

1. **Do NOT use `setx PATH ...`**
   - `setx` truncates PATH at ~1024 characters.
   - This can silently break `mise`, `winget`, and other tools.

2. **Always use PowerShell 7 (`pwsh`)**
   - PowerShell 5.1 does not reliably merge User + Machine PATH.
   - `mise` relies on shims being visible in PATH at runtime.

3. **PATH correctness is runtime-dependent**
   - Registry PATH values ≠ `$env:PATH` in a running shell.
   - Always verify `$env:PATH`, not just system settings.

---

## Install Prerequisites

### PowerShell 7

Install via winget:

    winget install Microsoft.PowerShell

Verify:

    pwsh --version

---

### mise (runtime manager)

Install via PowerShell 7:

    irm https://astral.sh/mise/install.ps1 | iex

Verify:

    mise --version

---

## PATH Configuration (Required)

`mise` works via **shims**, which must be present in PATH **inside the running shell**.

On Windows, PowerShell does not always merge User + Machine PATH automatically.
We fix this explicitly.

---

## PowerShell 7 Profile Setup

### Profile location

Create (if missing):

    C:\Users\<your-user>\Documents\PowerShell\Microsoft.PowerShell_profile.ps1

You can open it with:

    notepad $PROFILE

---

### Required profile contents

Add **exactly** the following:

    $userPath    = [Environment]::GetEnvironmentVariable("Path","User")
    $machinePath = [Environment]::GetEnvironmentVariable("Path","Machine")
    $env:PATH    = "$userPath;$machinePath"

    if (Get-Command mise -ErrorAction SilentlyContinue) {
        (& mise activate pwsh) -join "`n" | Invoke-Expression
    }

This ensures:
- User + Machine PATH are merged deterministically
- `mise` shims take effect in every session

---

## Minimal User PATH (Recommended)

Your **User PATH** should be short and clean.

Recommended entries:

    %USERPROFILE%\AppData\Local\Microsoft\WindowsApps
    %USERPROFILE%\AppData\Local\mise\shims
    %USERPROFILE%\AppData\Local\mise\bin

> You do **not** need to remove system-wide Node installations.
> `mise` will override them as long as shims resolve first.

---

## Verifying the Setup

From **PowerShell 7**, inside the repo root:

    mise which node
    where.exe node
    node --version

Expected:
- `mise which node` → path inside `...mise\installs\...`
- `where.exe node` → resolves to `...mise\shims\node`
- `node --version` → matches the version in `.mise.toml`

---

## Bootstrap Script

This repo includes a helper script:

    scripts/windows/bootstrap.ps1

Run it from PowerShell 7:

    pwsh scripts/windows/bootstrap.ps1

The script:
- Verifies PowerShell version
- Checks PATH visibility of `mise` shims
- Shows which `node` binary is resolved
- Confirms runtime versions

It **does not** modify PATH or registry values.

---

## Common Failure Modes

### `mise which node` is correct, but `node --version` is wrong

Cause:
- `mise` shims are not on `$env:PATH` in the current shell.

Fix:
- Ensure you are using `pwsh`
- Ensure the profile merges PATH and activates `mise`

---

### PATH looks correct in System Settings, but not in shell

Cause:
- PowerShell session started with incomplete PATH

Fix:
- Restart PowerShell 7
- Verify `$env:PATH` directly

---

### `winget`, `mise`, or other tools disappeared

Cause:
- `setx PATH` truncated User PATH

Fix:
- Restore PATH manually via System Settings
- Restart PowerShell 7
- Never use `setx` again

---

## Non-Goals

- Supporting PowerShell 5.1
- Automatic PATH registry mutation
- One-click “magic” installers

If your setup matches this document, YASBA tooling should behave
**deterministically and boringly** on Windows.

That is the goal.
