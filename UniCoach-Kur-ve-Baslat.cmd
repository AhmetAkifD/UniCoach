@echo off
chcp 65001 >nul
title UniCoach
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kurulum\kurulum.ps1"
if errorlevel 1 pause
