@echo off
rem Uji login dan baca APM dari PC ini TANPA mengirim apa pun ke PowerOps.
node "%~dp0apm-agent.js" --coba
echo.
pause
