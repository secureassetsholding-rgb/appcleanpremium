# fix-dashboard.ps1 - Versión mejorada
# Script para corregir la estructura JSX del tab 'overview' en Dashboard.tsx

$filePath = "C:\Users\Luis888\Desktop\brightworks\brightworks-deploy\src\pages\Dashboard.tsx"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Dashboard.tsx - JSX Structure Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $filePath)) {
    Write-Host "ERROR: No se encontró el archivo en: $filePath" -ForegroundColor Red
    exit 1
}

Write-Host "Leyendo archivo: $filePath" -ForegroundColor Yellow
$content = Get-Content $filePath -Raw

# Verificar si ya está corregido
if ($content -match 'activeTab === ''overview'' && \(\s+<>') {
    Write-Host "El archivo ya parece estar corregido (contiene fragmento <>)..." -ForegroundColor Yellow
    Write-Host "¿Deseas continuar de todos modos? (S/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne 'S' -and $response -ne 's') {
        Write-Host "Operación cancelada." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Aplicando cambios..." -ForegroundColor Yellow

# Cambio 1: Línea 385 - Cambiar <div className="space-y-6"> a <>
$content = $content -replace '(\s+)\{activeTab === ''overview'' && \(\s+)<div className="space-y-6">', '$1{activeTab === ''overview'' && ($1<>'

# Cambio 2: Línea 386 - Agregar <div className="space-y-6"> antes del comentario
$content = $content -replace '(\s+)\{/\* Key Performance Indicators', '$1<div className="space-y-6">$1{/* Key Performance Indicators'

# Cambio 3: Ajustar indentación de las líneas 388-454 (agregar 2 espacios)
# Esto es más complejo, necesitamos hacerlo línea por línea
$lines = $content -split "`r?`n"
$newLines = @()
$inKPISection = $false
$kpiStartFound = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNumber = $i + 1
    
    # Detectar inicio de sección KPI (línea con "grid gap-3")
    if ($line -match 'grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4' -and -not $kpiStartFound) {
        $inKPISection = $true
        $kpiStartFound = $true
        Write-Host "Línea $lineNumber: Detectado inicio de sección KPI" -ForegroundColor Green
    }
    
    # Detectar fin de sección KPI (línea con solo </div> después de varias líneas)
    if ($inKPISection -and $line -match '^\s+</div>\s*$' -and $i -gt 0) {
        # Verificar si la siguiente línea también es </div>
        if ($i + 1 -lt $lines.Count -and $lines[$i + 1] -match '^\s+</div>\s*$') {
            $inKPISection = $false
            Write-Host "Línea $lineNumber: Detectado fin de sección KPI" -ForegroundColor Green
        }
    }
    
    # Agregar 2 espacios de indentación si estamos en la sección KPI
    if ($inKPISection -and $kpiStartFound) {
        if ($line.Trim() -ne '') {
            $line = '  ' + $line
        }
    }
    
    $newLines += $line
}

$content = $newLines -join "`n"

# Cambio 4: Línea 457 - Cambiar )} a </> seguido de )}
$content = $content -replace '(\s+)</div>\s+</div>\s+\)\}', '$1</div>$1</div>$1</>$1)}'

Write-Host ""
Write-Host "Guardando archivo..." -ForegroundColor Yellow

# Guardar el archivo con codificación UTF-8
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "¡Cambios aplicados exitosamente!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Archivo guardado en: $filePath" -ForegroundColor Green
Write-Host ""
Write-Host "Por favor revisa el archivo antes de hacer commit." -ForegroundColor Yellow