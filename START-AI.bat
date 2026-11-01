@echo off
title PIGEM System Server

set PYTHONDONTWRITEBYTECODE=1

set "ROOT=%~dp0"
if not exist "%ROOT%api\main.py" set "ROOT=C:\pigem-system\"
cd /d "%ROOT%api"

echo Starting PIGEM Server on http://127.0.0.1:8001 ...
echo Keep this window open while using the system.
echo.

.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
pause
