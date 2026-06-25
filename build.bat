@echo off
REM Vega Sorgu - YEREL masaustu installer olustur (yayinlamadan).
REM Cikti: dist\Vega Sorgu Setup x.y.z.exe
echo [1/3] Frontend derleniyor...
cd client
call npm install
call npm run build
if %errorlevel% neq 0 ( echo Frontend derleme hatasi. & exit /b %errorlevel% )
cd ..

echo [2/3] Statik dosyalar server\public'e kopyalaniyor...
if exist "server\public" rmdir /s /q "server\public"
mkdir "server\public"
xcopy /E /I /Y "client\dist\*" "server\public\"

echo [3/3] Electron installer paketleniyor...
call npm install
call npm run dist
if %errorlevel% neq 0 ( echo Paketleme hatasi. & exit /b %errorlevel% )

echo.
echo Tamamlandi. Installer: dist klasorunde.
