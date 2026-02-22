# Script para aplicar todas las mejoras de Bright Works
# Ubicación: C:\Users\Luis888\Desktop\brightworks\brightworks-deploy

$basePath = "C:\Users\Luis888\Desktop\brightworks\brightworks-deploy"
$dashboardLayoutPath = Join-Path $basePath "src\components\DashboardLayout.tsx"
$taskTablePath = Join-Path $basePath "src\components\TaskTable.tsx"

Write-Host "Aplicando mejoras a Bright Works..." -ForegroundColor Cyan

# 1. ELIMINAR QR CIRCULAR DEL SIDEBAR EN DashboardLayout.tsx
Write-Host "`n1. Eliminando QR circular del sidebar..." -ForegroundColor Yellow

if (Test-Path $dashboardLayoutPath) {
    $content = Get-Content $dashboardLayoutPath -Raw -Encoding UTF8
    
    # Eliminar import de PremiumQRCode (línea 21)
    $content = $content -replace "import \{ PremiumQRCode \} from '\./PremiumQRCode'\r?\n", ""
    
    # Eliminar variable installUrl (línea 82)
    $content = $content -replace "  const installUrl = typeof window !== 'undefined' \? window\.location\.origin : ''\r?\n", ""
    
    # Eliminar componentes PremiumQRCode (líneas 296-301)
    $content = $content -replace "          <div className=`"hidden md:block`">\r?\n            <PremiumQRCode value=\{installUrl \|\| 'https://brightworks\.app'\} />\r?\n          </div>\r?\n          <div className=`"block md:hidden`">\r?\n            <PremiumQRCode value=\{installUrl \|\| 'https://brightworks\.app'\} className=`"scale-75 sm:scale-90`" />\r?\n          </div>\r?\n", ""
    
    $content | Set-Content $dashboardLayoutPath -Encoding UTF8 -NoNewline
    Write-Host "   ✓ QR circular eliminado del sidebar" -ForegroundColor Green
} else {
    Write-Host "   ✗ No se encontró DashboardLayout.tsx" -ForegroundColor Red
}

# 2. MEJORAR RESPONSIVIDAD DE TABLAS EN TaskTable.tsx
Write-Host "`n2. Mejorando responsividad de tablas para tablets..." -ForegroundColor Yellow

if (Test-Path $taskTablePath) {
    $content = Get-Content $taskTablePath -Raw -Encoding UTF8
    
    # Reemplazar grid-cols del header (líneas 968-972) con valores optimizados para tablets
    $oldHeaderGrid = "'grid w-full min-w-full grid-cols-\[minmax\(160px,1fr\)_repeat\(5,minmax\(110px,1fr\)\)\] border-b bg-slate-900/80',\s+'sm:grid-cols-\[minmax\(200px,1fr\)_repeat\(5,minmax\(130px,1fr\)\)\] sm:min-w-\[800px\]',\s+'md:grid-cols-\[minmax\(240px,1fr\)_repeat\(5,minmax\(160px,1fr\)\)\] md:min-w-\[1100px\]',\s+'lg:grid-cols-\[minmax\(260px,1fr\)_repeat\(5,minmax\(180px,1fr\)\)\] lg:min-w-\[1300px\]',\s+'xl:grid-cols-\[minmax\(280px,1fr\)_repeat\(5,minmax\(200px,1fr\)\)\] xl:min-w-\[1500px\]',"
    
    $newHeaderGrid = "'grid w-full min-w-full grid-cols-[minmax(140px,1fr)_repeat(5,minmax(90px,1fr))] border-b bg-slate-900/80',
          'sm:grid-cols-[minmax(180px,1fr)_repeat(5,minmax(110px,1fr))] sm:min-w-[700px]',
          'md:grid-cols-[minmax(200px,1fr)_repeat(5,minmax(120px,1fr))] md:min-w-[900px]',
          'lg:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(160px,1fr))] lg:min-w-[1100px]',
          'xl:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(180px,1fr))] xl:min-w-[1300px]',
          '2xl:grid-cols-[minmax(280px,1fr)_repeat(5,minmax(200px,1fr))] 2xl:min-w-[1500px]',"
    
    $content = $content -replace [regex]::Escape($oldHeaderGrid), $newHeaderGrid
    
    # Reemplazar grid-cols de las filas (líneas 1032-1036) con valores optimizados para tablets
    $oldRowGrid = "'grid w-full min-w-full grid-cols-\[minmax\(160px,1fr\)_repeat\(5,minmax\(110px,1fr\)\)\] border-b transition-colors duration-150',\s+'sm:grid-cols-\[minmax\(200px,1fr\)_repeat\(5,minmax\(130px,1fr\)\)\] sm:min-w-\[800px\]',\s+'md:grid-cols-\[minmax\(240px,1fr\)_repeat\(5,minmax\(160px,1fr\)\)\] md:min-w-\[1100px\]',\s+'lg:grid-cols-\[minmax\(260px,1fr\)_repeat\(5,minmax\(180px,1fr\)\)\] lg:min-w-\[1300px\]',\s+'xl:grid-cols-\[minmax\(280px,1fr\)_repeat\(5,minmax\(200px,1fr\)\)\] xl:min-w-\[1500px\]',"
    
    $newRowGrid = "'grid w-full min-w-full grid-cols-[minmax(140px,1fr)_repeat(5,minmax(90px,1fr))] border-b transition-colors duration-150',
                'sm:grid-cols-[minmax(180px,1fr)_repeat(5,minmax(110px,1fr))] sm:min-w-[700px]',
                'md:grid-cols-[minmax(200px,1fr)_repeat(5,minmax(120px,1fr))] md:min-w-[900px]',
                'lg:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(160px,1fr))] lg:min-w-[1100px]',
                'xl:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(180px,1fr))] xl:min-w-[1300px]',
                '2xl:grid-cols-[minmax(280px,1fr)_repeat(5,minmax(200px,1fr))] 2xl:min-w-[1500px]',"
    
    $content = $content -replace [regex]::Escape($oldRowGrid), $newRowGrid
    
    # Agregar media queries CSS al Daily Report (después de línea 773)
    $mediaQueries = @"
        @media (max-width: 768px) {
          body { padding: 16px 12px; }
          .logo-header { flex-direction: column; text-align: center; gap: 12px; }
          .logo-header img { width: 60px; height: 60px; }
          .logo-header h1 { font-size: 24px; }
          header h2 { font-size: 20px; }
          .stats-grid { grid-template-columns: 1fr; gap: 12px; }
          .stat-card { padding: 16px; }
          .stat-card .value { font-size: 24px; }
          .overview { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .day-grid { grid-template-columns: 1fr; gap: 16px; }
          .day-card { padding: 16px; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          body { padding: 24px 16px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .day-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1025px) {
          .day-grid { grid-template-columns: repeat(3, 1fr); }
        }
"@
    
    # Insertar media queries antes del cierre de </style>
    $content = $content -replace "(\s+@media print \{[^}]+\}\s+</style>)", "`$1`n$mediaQueries`n"
    
    $content | Set-Content $taskTablePath -Encoding UTF8 -NoNewline
    Write-Host "   ✓ Responsividad de tablas mejorada para tablets" -ForegroundColor Green
    Write-Host "   ✓ Media queries CSS agregadas al Daily Report" -ForegroundColor Green
} else {
    Write-Host "   ✗ No se encontró TaskTable.tsx" -ForegroundColor Red
}

Write-Host "`n✓ Todas las mejoras aplicadas exitosamente!" -ForegroundColor Green
Write-Host "`nResumen de cambios:" -ForegroundColor Cyan
Write-Host "  1. QR circular eliminado del sidebar" -ForegroundColor White
Write-Host "  2. Tablas optimizadas para tablets (min-width reducido)" -ForegroundColor White
Write-Host "  3. Media queries CSS agregadas al Daily Report" -ForegroundColor White
Write-Host "`nPor favor, verifica los cambios y ejecuta 'npm run build' si es necesario." -ForegroundColor Yellow