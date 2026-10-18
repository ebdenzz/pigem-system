@echo off
title PIGEM System Starter
echo ================================================
echo Starting PIGEM System...
echo ================================================

REM 1. Use Python 3.11 virtual environment (.venv311)
if not exist "%~dp0api\.venv311\Scripts\python.exe" (
    echo Setting up Python environment for the first time...
    python -m venv "%~dp0api\.venv311"
    "%~dp0api\.venv311\Scripts\python.exe" -m pip install -r "%~dp0api\requirements.txt"
)

REM 2. Create .env file from .env.example if not created yet
if not exist "%~dp0api\.env" (
    copy "%~dp0api\.env.example" "%~dp0api\.env" >nul
)

REM 3. Start the Website on http://127.0.0.1:5500
echo Starting Website on http://127.0.0.1:5500 ...
start "PIGEM Website (Port 5500)" cmd /k "cd /d "%~dp0web" && "%~dp0api\.venv311\Scripts\python.exe" -m http.server 5500 --bind 127.0.0.1"

REM 4. Start the Python FastAPI Server on http://127.0.0.1:8001
echo Starting Python API on http://127.0.0.1:8001 ...
start "PIGEM Python API (Port 8001)" cmd /k "cd /d "%~dp0api" && "%~dp0api\.venv311\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001"

REM 5. Wait 2 seconds and open the browser automatically
timeout /t 2 /nobreak >nul
start http://127.0.0.1:5500/index.html

echo.
echo Done! Your browser should open http://127.0.0.1:5500/index.html
pause
