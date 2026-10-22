@echo off
cd /d "%~dp0"
node scripts\setup-env.mjs
if errorlevel 1 (pause & exit /b 1)
docker compose up --build
pause
