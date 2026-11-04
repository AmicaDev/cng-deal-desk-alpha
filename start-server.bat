@echo off
title CNG Deal Desk - Local Server
echo ========================================================
echo   Launching CNG Deal Desk App on this computer...
echo ========================================================
echo.

REM The PowerShell server provides the index.html fallback needed for SPA routes.
echo Starting server using Windows PowerShell...
start http://localhost:8080
powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"

:end
pause
