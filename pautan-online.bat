@echo off
title Sistem Nama Majlis - Pautan Online
cd /d "%~dp0"

if not exist node_modules\express (
  echo Memasang keperluan buat kali pertama...
  call npm install
)

echo.
echo   Memberi pautan internet untuk semua perangkat...
echo   (perlukan internet + cloudflared. Ctrl+C untuk berhenti.)
echo.

node online.js

echo.
echo   Siap. Pautan online telah ditutup.
pause
