# scripts/windows/bootstrap.ps1
$ErrorActionPreference = "Stop"

Write-Host "== YASBA Windows bootstrap checks =="

Write-Host "`nPowerShell:"
$psv = $PSVersionTable.PSVersion
Write-Host "  Version: $psv"
if ($psv.Major -lt 7) {
  Write-Host "  ERROR: Use PowerShell 7 (pwsh)." -ForegroundColor Red
  exit 1
}

Write-Host "`nPATH contains mise shims?"
$path = $env:PATH
$hasShims = $path -match "\\mise\\shims"
Write-Host "  $hasShims"

Write-Host "`nResolved node:"
where.exe node

Write-Host "`nmise which node:"
mise which node

Write-Host "`nnode --version:"
node --version
