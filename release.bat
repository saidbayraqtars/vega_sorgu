@echo off
REM Vega Kopru - GitHub Release yayinla (kurulu uygulamalar otomatik guncellenir)
REM Kullanim: release.bat [patch|minor|major|none]   (varsayilan: patch)
node scripts\release.js %1
