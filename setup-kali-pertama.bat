@echo off
REM =====================================================================
REM  Sistem Nama Majlis - SETUP KALI PERTAMA (PC baru)
REM  Tekan kanan lalu pilih "Run as administrator" - sekali sahaja pada
REM  PC baru, selepas Node.js dipasang.
REM =====================================================================
cd /d "%~dp0"

echo === Sedang menyediakan PC ini sebagai pelayan majlis ===
echo.

REM --- 1. Semak Node.js -------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js tidak jumpa. Pasang dulu dari laman https://nodejs.org
  echo     pilih versi LTS untuk Windows 64-bit. Selepas pasang, jalankan
  echo     fail ini sekali lagi.
  pause
  exit /b 1
)
echo [ok] Node.js djumpa. Versi:
node --version

REM --- 2. Pasang pakej (sharp, express, dll.) ---------------------------
if exist node_modules (
  echo [ok] Pakej sudah ada - langkah npm install dilangkau.
) else (
  echo.
  echo [..] Memasang pakej. npm install - mungkin ambil sedikit masa.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [X] npm install gagal. Semak internet lalu cuba sekali lagi.
    pause
    exit /b 1
  )
)

REM --- 3. Buka port 80 & 443 dalam Windows Firewall ---------------------
echo.
echo [..] Membuka port web dalam Windows Firewall.
netsh advfirewall firewall add rule name="Majlis Web 80"  dir=in action=allow protocol=TCP localport=80  >nul 2>nul
netsh advfirewall firewall add rule name="Majlis Web 443" dir=in action=allow protocol=TCP localport=443 >nul 2>nul
echo [ok] Port 80 dan 443 dibenarkan masuk.

REM --- 4. Halang PC daripada tidur --------------------------------------
echo [..] Melaraskan kuasa supaya PC tidak tidur.
powercfg /change standby-timeout-ac 0   >nul 2>nul
powercfg /change hibernate-timeout-ac 0 >nul 2>nul
powercfg /change monitor-timeout-ac 10  >nul 2>nul
echo [ok] Skrin boleh padam, tetapi PC akan kekal berjaga.

REM --- 5. Papar IP PC ini ------------------------------------------------
echo.
echo === Alamat IP PC ini sekarang ===
ipconfig | findstr /i "IPv4"
echo.
echo Pada hari majlis, buka pautan ini di perangkat lain (ganti IP):
echo     http://IP-PC-INI/scan.html       untuk pengimbas daftar & papar
echo     http://IP-PC-INI/display.html    untuk skrin projektor
echo     http://IP-PC-INI/admin.html      untuk admin (kunci jika ada)
echo.
echo Selesai. Selepas ini, setiap kali mahu memulakan pelayan, tekan 2x
echo fail "server-jalan.bat".
echo.
echo CADANGAN biar pelayan naik sendiri bila PC dihidupkan:
echo     tekan Win+R, taip shell:startup lalu Enter, kemudian letak
echo     shortcut "server-jalan.bat" ke dalam folder Startup itu.
echo.
pause
