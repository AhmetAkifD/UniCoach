@echo off
chcp 65001 >nul
title UniCoach
"%~dp0runtime\node.exe" "%~dp0runtime\launcher.cjs"
if errorlevel 1 pause
