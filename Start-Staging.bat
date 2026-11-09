@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-staging.ps1"
if errorlevel 1 (
  echo.
  echo Staging gagal dijalankan. Baca pesan error di atas.
  pause
)
