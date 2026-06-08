# Esco Playground Launcher
$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Esco Playground" -ForegroundColor Cyan
Write-Host "  Project: $ProjectDir" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan

# Find Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Python: $($python.Source)" -ForegroundColor Green

# Find Node / npx
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
    Write-Host "ERROR: Node.js / npx not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Node: $($npx.Source)" -ForegroundColor Green

# Start Python backend
Write-Host ""
Write-Host "[1/3] Starting Python backend..." -ForegroundColor Yellow
$backend = Start-Process -FilePath $python.Source `
    -ArgumentList "-m", "uvicorn", "backend.main:app", "--port", "8000", "--reload", "--log-level", "info" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Minimized `
    -PassThru
Write-Host "      Backend PID: $($backend.Id)" -ForegroundColor DarkGray

# Start Vite
Write-Host "[2/3] Starting Vite frontend..." -ForegroundColor Yellow
$vite = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx vite --port 5173" `
    -WorkingDirectory "$ProjectDir\frontend" `
    -WindowStyle Minimized `
    -PassThru
Write-Host "      Vite PID: $($vite.Id)" -ForegroundColor DarkGray

# Wait for Vite to be ready
Write-Host "      Waiting for Vite..." -ForegroundColor DarkGray
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
    Write-Host "      WARNING: Vite may not be ready yet" -ForegroundColor Yellow
}

# Launch Electron
Write-Host "[3/3] Launching Esco Playground..." -ForegroundColor Yellow
$env:NODE_ENV = "development"
& npx electron .

Write-Host ""
Write-Host "Esco Playground closed." -ForegroundColor DarkGray

# Cleanup
Write-Host "Stopping services..." -ForegroundColor DarkGray
Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
Stop-Process -Id $vite.Id -ErrorAction SilentlyContinue
