cd C:\Users\Luis888\Desktop\brightworks\brightworks-deploy

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUBIENDO TODAS LAS CARPETAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1] Verificando carpetas locales..." -ForegroundColor Yellow
if (Test-Path "public") { Write-Host "  ✓ public/ existe" -ForegroundColor Green } else { Write-Host "  ✗ public/ NO existe" -ForegroundColor Red }
if (Test-Path "src") { Write-Host "  ✓ src/ existe" -ForegroundColor Green } else { Write-Host "  ✗ src/ NO existe" -ForegroundColor Red }
Write-Host ""

Write-Host "[2] Agregando TODOS los archivos..." -ForegroundColor Yellow
git add -A
Write-Host "Archivos agregados" -ForegroundColor Green
Write-Host ""

Write-Host "[3] Archivos en staging..." -ForegroundColor Yellow
$staged = git diff --cached --name-only
Write-Host "Total archivos: $($staged.Count)" -ForegroundColor Cyan
$staged | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
if ($staged.Count -gt 20) { Write-Host "  ... y $($staged.Count - 20) más" -ForegroundColor Gray }
Write-Host ""

Write-Host "[4] Verificando carpetas en staging..." -ForegroundColor Yellow
$hasPublic = $staged | Where-Object { $_ -like "public/*" }
$hasSrc = $staged | Where-Object { $_ -like "src/*" }
if ($hasPublic) { Write-Host "  ✓ public/ tiene archivos" -ForegroundColor Green } else { Write-Host "  ✗ public/ NO tiene archivos" -ForegroundColor Red }
if ($hasSrc) { Write-Host "  ✓ src/ tiene archivos" -ForegroundColor Green } else { Write-Host "  ✗ src/ NO tiene archivos" -ForegroundColor Red }
Write-Host ""

Write-Host "[5] Haciendo commit..." -ForegroundColor Yellow
git commit -m "Add all folders: public, src, and complete project structure"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Commit realizado" -ForegroundColor Green
} else {
    Write-Host "INFO: Verificando estado..." -ForegroundColor Yellow
    git status
}
Write-Host ""

Write-Host "[6] SUBIENDO A GITHUB..." -ForegroundColor Yellow
git push origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "EXITO: Todas las carpetas subidas" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repositorio: https://github.com/brightbroks-star/Brightworksprofesional" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Revisa credenciales" -ForegroundColor Red
}

Write-Host ""
Read-Host "Presiona Enter para continuar"





