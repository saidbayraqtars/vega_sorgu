@echo off
REM Vega Kopru - YEREL Windows kurulumu olustur (yayinlamadan).
REM Cikti: dist\VegaKopru-Setup-x.y.z.exe
echo [1/2] Bagimliliklar kuruluyor...
call npm install
if %errorlevel% neq 0 ( echo npm install hatasi. & exit /b %errorlevel% )

echo [2/2] Electron kurulumu paketleniyor...
call npm run dist
if %errorlevel% neq 0 ( echo Paketleme hatasi. & exit /b %errorlevel% )

echo.
echo Tamamlandi. Kurulum: dist klasorunde.
