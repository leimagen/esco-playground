@echo off
title Esco Playground
cd /d "%~dp0"

echo ==========================================
echo  Esco Playground - Starting...
echo  Project dir: %~dp0
echo ==========================================

:: Check Node is available
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)

:: Check Python is available
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found.
    pause & exit /b 1
)

:: Check Ollama is available
where ollama >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama not found in PATH. Install from https://ollama.ai
    echo The app will open but AI chat will not work.
)

echo [1/3] Starting Python backend...
start "Esco Backend" /min cmd /c "cd /d "%~dp0" && python -m uvicorn backend.main:app --port 8000 --reload --log-level info & pause"
timeout /t 4 /nobreak >nul

echo [2/3] Starting Vite frontend...
start "Esco Frontend" /min cmd /c "cd /d "%~dp0frontend" && npx vite --port 5173 & pause"
timeout /t 5 /nobreak >nul

echo [3/3] Compiling Electron...
npx tsc -p tsconfig.electron.json
if errorlevel 1 (
    echo ERROR: TypeScript compilation failed.
    pause & exit /b 1
)

echo [3/3] Launching Esco Playground window...
set NODE_ENV=development
npx electron .

echo.
echo Esco Playground closed.
pause
