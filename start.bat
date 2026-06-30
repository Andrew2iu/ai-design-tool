@echo off
chcp 65001 >nul 2>&1

echo ========================================
echo  AI Design Studio
echo ========================================
echo.

set "NODE_EXE=C:\Users\28782\.workbuddy\binaries\node\versions\22.22.2\node.exe"
set "PYTHON_EXE=C:\Users\28782\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
set "BASE=%~dp0"

echo [1/2] Starting backend (port 8000)...
start "AI-Backend" cmd /c "cd /d "%BASE%backend\python" && "%PYTHON_EXE%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (port 3000)...
start "AI-Frontend" cmd /c "cd /d "%BASE%frontend" && "%NODE_EXE%" node_modules\vite\bin\vite.js --port 3000 --host"
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo  Frontend: http://localhost:3000
echo  API:     http://localhost:8000/docs
echo ========================================
echo.
echo [!] AI features need DEEPSEEK_API_KEY in .env
echo.
pause
