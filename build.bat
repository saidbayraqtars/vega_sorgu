@echo off
echo ========================================================
echo        Vega Sorgu - Tek Parca (EXE) Olusturucu
echo ========================================================
echo.

echo [1/4] Frontend (istemci) bagimliliklari kuruluyor ve derleniyor...
cd client
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo Frontend derlenirken bir hata olustu.
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/4] Statik dosyalar sunucuya kopyalaniyor...
if exist "server\public" rmdir /s /q "server\public"
mkdir "server\public"
xcopy /E /I /Y "client\dist\*" "server\public\"

echo.
echo [3/4] Backend (sunucu) bagimliliklari kuruluyor...
cd server
call npm install
if %errorlevel% neq 0 (
    echo Backend bagimliliklari kurulurken bir hata olustu.
    exit /b %errorlevel%
)

echo.
echo [4/4] Uygulama paketleniyor (pkg)...
call npx pkg . --targets node18-win-x64 --output ../VegaSorgu.exe
if %errorlevel% neq 0 (
    echo Uygulama paketlenirken bir hata olustu.
    exit /b %errorlevel%
)
cd ..

echo.
echo ========================================================
echo Islem tamamlandi! Uygulamaniz hazir: VegaSorgu.exe
echo ========================================================
