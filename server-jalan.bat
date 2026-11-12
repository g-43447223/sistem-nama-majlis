@echo off
REM =====================================================================
REM  Sistem Nama Majlis - PELANCAR HARIAN (tekan 2x untuk mulakan)
REM  Pelayan berjalan sampai tetingkap ini ditutup / Ctrl+C.
REM =====================================================================
cd /d "%~dp0"

set PORT=80
set HTTPS_PORT=443

REM By default: LOCAL mode without a key - the same as the usual setup
REM on the school LAN. Scanner and projector devices don't need a key.
REM
REM If this PC is directly connected to the internet and you WANT a key,
REM remove the REM on the next line. Then all devices must open
REM scan.html?kunci=KUNCI_ANDA (admin too).
REM set MAJLIS_KUNCI=805AD3

node server.js
if errorlevel 1 (
  echo.
  echo [RALAT] Pelayan tak dapat naik. Sebab biasa:
  echo   - Node.js belum dipasang - download LTS di https://nodejs.org
  echo   - Belum setup - tekan 2x "setup-kali-pertama.bat" sekali sahaja
  echo   - Port 80 dipakai program lain - tutup IIS/XAMPP/AppServer
  echo   - Pelayan lain masih berjalan di PC ini - tutup dulu
  pause
)
