@echo off
REM Vega Sorgu - GitHub Release yayinla
REM Kullanim: release.bat [patch|minor|major|none]   (varsayilan: patch)
node scripts\release.js %1
