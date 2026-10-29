@echo off
setlocal
rem Pasang jadwal Task Scheduler: jalankan agen APM tiap jam pada menit ke-10.

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE (
  echo Node.js belum terpasang. Pasang Node.js LTS dari https://nodejs.org lalu jalankan lagi.
  pause
  exit /b 1
)
if not exist "%~dp0apm-agent.env" (
  echo apm-agent.env belum ada. Salin apm-agent.env.example jadi apm-agent.env lalu isi.
  pause
  exit /b 1
)

schtasks /Create /F /SC HOURLY /ST 00:10 /TN "PowerOps APM Sync" /TR "\"%NODE%\" \"%~dp0apm-agent.js\""
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Jadwal "PowerOps APM Sync" terpasang: tiap jam pada menit ke-10.
echo Cek hasilnya di apm-agent.log (folder ini) atau di banner /dashboard.
echo Hapus jadwal: schtasks /Delete /TN "PowerOps APM Sync" /F
pause
