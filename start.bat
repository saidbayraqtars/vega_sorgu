@echo off
REM Vega Sorgu - gelistirme modunda calistir (Electron + sunucu).
REM Once frontend'i bir kez derleyip server\public'e koy, sonra electron baslat.
if not exist "server\public\index.html" (
  echo Frontend ilk kez derleniyor...
  cd client && call npm install && call npm run build && cd ..
  if not exist "server\public" mkdir "server\public"
  xcopy /E /I /Y "client\dist\*" "server\public\"
)
call npm start
