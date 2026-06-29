@echo off
chcp 65001 >nul 2>&1

echo ========================================
echo  AI Design Studio - 一键启动
echo  面向2026的AI原生产品设计工具
echo ========================================
echo.

set PYTHON_EXE=C:\Users\28782\.workbuddy\binaries\python\envs\default\Scripts\python.exe
set NODE_EXE=C:\Users\28782\.workbuddy\binaries\node\versions\22.22.2\node.exe
set BASE=%~dp0

REM ---------- 构建 MCP ----------
echo [0/3] 构建 MCP 服务...
if not exist "%BASE%backend\node\dist\index.js" (
    "%NODE_EXE%" "%BASE%backend\node\node_modules\typescript\bin\tsc" --project "%BASE%backend\node"
    if exist "%BASE%backend\node\dist\index.js" (
        echo MCP 构建成功
    ) else (
        echo [警告] MCP 构建失败，跳过 MCP 服务
    )
) else (
    echo MCP 已构建，跳过
)

REM ---------- 启动 Python 后端 ----------
echo [1/3] 启动 FastAPI 后端 (端口 8000)...
start "AI-Backend" cmd /k "cd /d %BASE%backend\python && %PYTHON_EXE% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

REM ---------- 启动 MCP 服务 ----------
echo [2/3] 启动 MCP 服务 (端口 3001)...
if exist "%BASE%backend\node\dist\index.js" (
    start "AI-MCP-Server" cmd /k "cd /d %BASE%backend\node && %NODE_EXE% dist\index.js"
) else (
    echo [提示] MCP 未构建，跳过
)
timeout /t 2 /nobreak >nul

REM ---------- 启动前端 ----------
echo [3/3] 启动前端 (端口 3000)...
start "AI-Frontend" cmd /k "cd /d %BASE%frontend && %NODE_EXE% node_modules\vite\bin\vite.js --port 3000 --host"
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo  全部启动完成！
echo  前端: http://localhost:3000
echo  API:  http://localhost:8000/docs
echo ========================================
echo.
echo [提示] AI 生成功能需要填写 .env 中的 DEEPSEEK_API_KEY
echo [提示] 如果某个窗口闪退或有红色报错，请截图发给我
echo.
pause
