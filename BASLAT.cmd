@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js 24 LTS gerekli. & pause & exit /b 1)
where python >nul 2>nul
if errorlevel 1 (echo Python 3.9+ gerekli. & pause & exit /b 1)
if not exist node_modules\next\package.json (
  call npm ci --workspaces=false --ignore-scripts --no-fund --no-audit
  if errorlevel 1 (pause & exit /b 1)
)
echo Web: http://127.0.0.1:9148
echo Mobil onizleme: http://localhost:9150
echo Kapatmak icin Ctrl+C. PostgreSQL 17 kurulu olmali.
python scripts\run.py --mobile
pause
