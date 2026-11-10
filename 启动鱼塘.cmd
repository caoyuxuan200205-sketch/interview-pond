@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.Content -match 'interview-pond-api') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://127.0.0.1:5173"
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24.13 或更新版本，再重新打开。
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo 正在打开面试鱼塘，请保持此窗口运行。
call npm run dev -- --open
if errorlevel 1 pause
