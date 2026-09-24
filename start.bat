@echo off
REM Vega Kopru - gelistirme modunda calistir (tepsi uygulamasi + ayar penceresi).
if not exist "node_modules\electron" call npm install
call npm start
