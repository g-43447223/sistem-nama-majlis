@echo off
title Sistem Nama Majlis
cd /d "%~dp0"

if not exist node_modules\express (
  echo Memasang keperluan buat kali pertama...
  call npm install
)

rem Port 80/443 supaya pautan pendek tanpa ":3000".
rem Tukar jika port ini dipakai aplikasi lain: set PORT=3000 & set HTTPS_PORT=3443
if "%PORT%"=="" set PORT=80
if "%HTTPS_PORT%"=="" set HTTPS_PORT=443

echo.
echo   Membuka Sistem Nama Majlis...
echo   Pautan LAN: http://IP-laptop  (tanpa nombor port)
echo   Tutup tetingkap ini untuk hentikan pelayan.
echo.

start "" http://localhost:%PORT%
node server.js

echo.
echo   Pelayan telah berhenti.
pause
