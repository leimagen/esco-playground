# Esco Playground Launcher
$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Esco Playground" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Dir: $ProjectDir" -ForegroundColor DarkGray

# ── Find Python ─────────────────────────────────────────────
$python = $null
foreach ($candidate in @("python", "python3", "py")) {
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) { $python = $found.Source; break }
}
if (-not $python) {
    # Common install paths
    foreach ($p in @(
        "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "C:\Python314\python.exe", "C:\Python312\python.exe"
    )) { if (Test-Path $p) { $python = $p; break } }
}
if (-not $python) {
    Write-Host "ERROR: Python not found. Install from https://python.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}
Write-Host "[OK] Python: $python" -ForegroundColor Green

# ── Find Node / npm / npx ────────────────────────────────────
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    foreach ($p in @(
        "C:\nvm4w\nodejs\node.exe",
        "$env:APPDATA\nvm\nodejs\node.exe",
        "$env:ProgramFiles\nodejs\node.exe"
    )) { if (Test-Path $p) { $node = @{Source=$p}; break } }
}
if (-not $node) {
    Write-Host "ERROR: Node.js not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}
$nodeDir = Split-Path $node.Source
$npxExe  = Join-Path $nodeDir "npx.cmd"
if (-not (Test-Path $npxExe)) { $npxExe = Join-Path $nodeDir "npx" }
Write-Host "[OK] Node: $($node.Source)" -ForegroundColor Green

# ── Kill stale processes on needed ports ─────────────────────
foreach ($port in @(8000, 5173)) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
Start-Sleep 1

# ── Compile Electron TypeScript ───────────────────────────────
Write-Host ""
Write-Host "[0/3] Compiling Electron..." -ForegroundColor Yellow
$tsc = & $npxExe tsc -p tsconfig.electron.json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript compile error:" -ForegroundColor Red
    Write-Host $tsc -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}
Write-Host "      Compiled OK" -ForegroundColor Green

# ── Start Python backend ──────────────────────────────────────
Write-Host "[1/3] Starting Python backend..." -ForegroundColor Yellow
$backendOut = "$env:TEMP\esco-backend-out.log"
$backendErr = "$env:TEMP\esco-backend-err.log"
foreach ($f in @($backendOut, $backendErr)) { if (Test-Path $f) { Remove-Item $f -Force } }

$backend = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "main:app", "--port", "8000", "--log-level", "info" `
    -WorkingDirectory "$ProjectDir\backend" `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError  $backendErr `
    -WindowStyle Hidden `
    -PassThru
Write-Host "      Backend PID: $($backend.Id)" -ForegroundColor DarkGray

# Wait for backend health — use 127.0.0.1 explicitly (localhost can resolve to ::1 on Windows)
$backendReady = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep 1
    if ($backend.HasExited) {
        Write-Host "ERROR: Backend exited (code $($backend.ExitCode))." -ForegroundColor Red
        Write-Host "--- stdout ---" -ForegroundColor DarkGray
        if (Test-Path $backendOut) { Get-Content $backendOut | Write-Host }
        Write-Host "--- stderr ---" -ForegroundColor DarkGray
        if (Test-Path $backendErr) { Get-Content $backendErr | Write-Host }
        Read-Host "Press Enter to exit"; exit 1
    }
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $backendReady = $true; break }
    } catch {}
    if ($i -eq 10) {
        Write-Host "      Still waiting... last output:" -ForegroundColor DarkGray
        if (Test-Path $backendErr) { Get-Content $backendErr -Tail 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray } }
        if (Test-Path $backendOut) { Get-Content $backendOut -Tail 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray } }
    }
}
if ($backendReady) {
    Write-Host "      Backend ready!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Backend did not start in 45s." -ForegroundColor Red
    Write-Host "--- stdout ---" -ForegroundColor DarkGray
    if (Test-Path $backendOut) { Get-Content $backendOut | Write-Host }
    Write-Host "--- stderr ---" -ForegroundColor DarkGray
    if (Test-Path $backendErr) { Get-Content $backendErr | Write-Host }
    Read-Host "Press Enter to exit"; exit 1
}

# ── Start Vite ────────────────────────────────────────────────
Write-Host "[2/3] Starting Vite frontend..." -ForegroundColor Yellow
$vite = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "`"$npxExe`" vite --port 5173" `
    -WorkingDirectory "$ProjectDir\frontend" `
    -WindowStyle Minimized `
    -PassThru
Write-Host "      Vite PID: $($vite.Id)" -ForegroundColor DarkGray

$viteReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep 1
    try {
        $r = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $viteReady = $true; break }
    } catch {}
}
if ($viteReady) {
    Write-Host "      Vite ready!" -ForegroundColor Green
} else {
    Write-Host "      WARNING: Vite may not be ready, launching anyway..." -ForegroundColor Yellow
}

# ── Launch Electron ───────────────────────────────────────────
Write-Host "[3/3] Launching Esco Playground window..." -ForegroundColor Yellow
$env:NODE_ENV = "development"
& $npxExe electron .

# ── Cleanup ───────────────────────────────────────────────────
Write-Host "`nEsco Playground closed. Stopping services..." -ForegroundColor DarkGray
Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
Stop-Process -Id $vite.Id   -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor DarkGray
