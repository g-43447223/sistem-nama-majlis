@echo off
title Sistem Nama Majlis - Pautan Online
cd /d "%~dp0"

if not exist node_modules\express (
  echo Memasang keperluan buat kali pertama...
  call npm install
)

echo.
echo  Memberikan pautan internet untuk semua perangkat...
echo  Perlu: internet + cloudflared.
echo  Jangan tutup tetingkap ini selama majlis.
echo.

node online.js

echo.
echo  Siap. Pautan online telah ditutup (salinan terakhir ada dalam pautan-online.txt).
pause
