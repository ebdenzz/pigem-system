@echo off
title PIGEM Local AI Server (Port 8001)
echo ================================================
echo Starting PIGEM Local AI Document Screening Service...
echo OpenCV (Blur/Quality) + PaddleOCR + Ollama (qwen2.5:1.5b)
echo ================================================

REM 1. Ensure Python 3.11 virtual environment exists
if not exist "%~dp0api\.venv311\Scripts\python.exe" (
    echo Setting up Python environment...
    python -m venv "%~dp0api\.venv311"
    "%~dp0api\.venv311\Scripts\python.exe" -m pip install -r "%~dp0api\requirements.txt"
)

REM 2. Ensure api\.env exists
if not exist "%~dp0api\.env" (
    copy "%~dp0api\.env.example" "%~dp0api\.env" >nul
)

REM 3. Check if Ollama is running
curl -s http://localhost:11434 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [NOTE] Ollama does not seem to be running on port 11434.
    echo If Ollama is installed, please run 'ollama run qwen2.5:1.5b' in another window.
)

REM 4. Start the local Python AI Screening API on port 8001
echo.
echo Starting Local AI Screening API on http://127.0.0.1:8001 ...
echo Leave this window open while doing AI document screening.
echo.
cd /d "%~dp0api"
"%~dp0api\.venv311\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001
pause
