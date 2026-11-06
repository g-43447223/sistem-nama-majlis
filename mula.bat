@echo off
title Sistem Nama Majlis
cd /d "%~dp0"

if not exist node_modules\express (
  echo Memasang keperluan buat kali pertama...
  call npm install
)

echo.
echo   Membuka Sistem Nama Majlis...
echo   Tutup tetingkap ini untuk hentikan pelayan.
echo.

start "" http://localhost:3000
node server.js

echo.
echo   Pelayan telah berhenti.
pause
