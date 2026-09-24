// Sunucu modu (yalnız Windows): kimse oturum açmasa da köprü çalışsın diye SYSTEM hesabıyla
// açılışta başlayan bir Zamanlanmış Görev. Görev, ayar klasöründeki PowerShell başlatıcısını
// çalıştırır; başlatıcı kurulu uygulamanın Electron'unu Node kipinde (ELECTRON_RUN_AS_NODE)
// köprünün komut satırıyla açar ve süreç kapanırsa 15 sn sonra yeniden açar.
//
// Denetim dosyaları (ayar klasöründe):
//   kopru-servis.dur    → köprü ≤10 sn'de kapanır, başlatıcı döngüden çıkar (kaldırma)
//   kopru-servis.bekle  → köprü kapanır, başlatıcı bekler (güncelleme kurulurken; 30 dk sonra yok sayılır)
// Görev oluşturma/silme yönetici izni (UAC) ister.

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const GOREV = "Vega Kopru";

const psq = (s) => `'${String(s).replace(/'/g, "''")}'`;
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function dosyalar(dir) {
  return {
    baslatici: path.join(dir, "kopru-servis.ps1"),
    xml: path.join(dir, "kopru-servis.xml"),
    kur: path.join(dir, "kopru-servis-kur.ps1"),
    kaldir: path.join(dir, "kopru-servis-kaldir.ps1"),
    dur: path.join(dir, "kopru-servis.dur"),
    bekle: path.join(dir, "kopru-servis.bekle"),
    gunluk: path.join(dir, "servis-kurulum.log"),
  };
}

// Windows PowerShell 5.1 BOM'suz betiği ANSI kod sayfasıyla okur ("Köprü" bozulur) → UTF-8 BOM
function yazPs1(file, satirlar) {
  fs.writeFileSync(file, "﻿" + satirlar.join("\r\n") + "\r\n", "utf8");
}

function baslaticiIcerik({ exe, cli, dir }) {
  const f = dosyalar(dir);
  return [
    "# Vega Köprü — sunucu modu başlatıcısı (Vega Köprü uygulaması üretti; elle düzenlemeyin)",
    `$dir = ${psq(dir)}`,
    `$exe = ${psq(exe)}`,
    `$cli = ${psq(cli)}`,
    `$dur = ${psq(f.dur)}`,
    `$bekle = ${psq(f.bekle)}`,
    "$env:ELECTRON_RUN_AS_NODE = '1'",
    "$env:VEGA_KOPRU_DIR = $dir",
    "while ($true) {",
    "  if (Test-Path -LiteralPath $dur) { break }",
    "  if ((Test-Path -LiteralPath $bekle) -and ((Get-Item -LiteralPath $bekle).LastWriteTime -gt (Get-Date).AddMinutes(-30))) { Start-Sleep -Seconds 15; continue }",
    "  if (Test-Path -LiteralPath $exe) {",
    "    try { Start-Process -FilePath $exe -ArgumentList @(('\"' + $cli + '\"'), 'calistir', '--servis') -WindowStyle Hidden -Wait } catch { }",
    "  }",
    "  if (Test-Path -LiteralPath $dur) { break }",
    "  Start-Sleep -Seconds 15",
    "}",
  ];
}

// Görev tanımı (UTF-16): açılışta 1 dk gecikmeyle, süre sınırı yok, çakışan örnek açılmaz
function gorevXml({ baslatici }) {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Vega Köprü: Arctos/Vega verisini Vega Bulut'a eşitler (sunucu modu).</Description></RegistrationInfo>
  <Triggers><BootTrigger><Enabled>true</Enabled><Delay>PT1M</Delay></BootTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${xmlEsc(baslatici)}"</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

function kurIcerik(f) {
  return [
    "$ErrorActionPreference = 'Continue'",
    `Remove-Item -LiteralPath ${psq(f.dur)} -ErrorAction SilentlyContinue`,
    `Remove-Item -LiteralPath ${psq(f.bekle)} -ErrorAction SilentlyContinue`,
    `$log = ${psq(f.gunluk)}`,
    `schtasks.exe /Create /TN ${psq(GOREV)} /XML ${psq(f.xml)} /F 2>&1 | Out-File -LiteralPath $log -Encoding utf8`,
    "if ($LASTEXITCODE -ne 0) { exit 10 }",
    `schtasks.exe /Run /TN ${psq(GOREV)} 2>&1 | Out-File -LiteralPath $log -Append -Encoding utf8`,
    "exit 0",
  ];
}

function kaldirIcerik(f) {
  return [
    "$ErrorActionPreference = 'Continue'",
    `Set-Content -LiteralPath ${psq(f.dur)} -Value 'dur'`,
    `$log = ${psq(f.gunluk)}`,
    `schtasks.exe /End /TN ${psq(GOREV)} 2>&1 | Out-File -LiteralPath $log -Encoding utf8`,
    `schtasks.exe /Delete /TN ${psq(GOREV)} /F 2>&1 | Out-File -LiteralPath $log -Append -Encoding utf8`,
    "if ($LASTEXITCODE -ne 0) { exit 11 }",
    "exit 0",
  ];
}

function powershell(komut) {
  return new Promise((resolve) => {
    const enc = Buffer.from(komut, "utf16le").toString("base64");
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", enc],
      { windowsHide: true, timeout: 180000 }, (err, stdout, stderr) => resolve({ kod: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr }));
  });
}

// Betiği yönetici olarak çalıştır (UAC penceresi); çıkış kodu döner. 1223 = kullanıcı reddetti.
async function yonetici(ps1) {
  const komut = [
    "try {",
    `  $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + ${psq(ps1)} + '"'))`,
    "  exit $p.ExitCode",
    "} catch { exit 1223 }",
  ].join("\n");
  return (await powershell(komut)).kod;
}

async function kurulu() {
  if (process.platform !== "win32") return false;
  return new Promise((resolve) => {
    execFile("schtasks.exe", ["/Query", "/TN", GOREV], { windowsHide: true, timeout: 20000 }, (err) => resolve(!err));
  });
}

async function kur({ exe, cli, dir }) {
  if (process.platform !== "win32") throw new Error("Sunucu modu yalnız Windows'ta kullanılabilir.");
  const f = dosyalar(dir);
  fs.mkdirSync(dir, { recursive: true });
  yazPs1(f.baslatici, baslaticiIcerik({ exe, cli, dir }));
  fs.writeFileSync(f.xml, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(gorevXml({ baslatici: f.baslatici }), "utf16le")]));
  yazPs1(f.kur, kurIcerik(f));
  const kod = await yonetici(f.kur);
  if (kod === 1223) throw new Error("Yönetici izni verilmedi.");
  if (kod !== 0) throw new Error(`Görev oluşturulamadı (kod ${kod}). Ayrıntı: ${f.gunluk}`);
}

async function kaldir({ dir }) {
  if (process.platform !== "win32") throw new Error("Sunucu modu yalnız Windows'ta kullanılabilir.");
  const f = dosyalar(dir);
  yazPs1(f.kaldir, kaldirIcerik(f));
  const kod = await yonetici(f.kaldir);
  if (kod === 1223) throw new Error("Yönetici izni verilmedi.");
  if (kod !== 0) throw new Error(`Görev silinemedi (kod ${kod}). Ayrıntı: ${f.gunluk}`);
}

// Güncelleme kurulurken sunucu modundaki köprüyü duraklat / sonra sürdür
function duraklat(dir) { try { fs.writeFileSync(dosyalar(dir).bekle, new Date().toISOString()); } catch { /* yok */ } }
function surdur(dir) { try { fs.unlinkSync(dosyalar(dir).bekle); } catch { /* yok */ } }

module.exports = { GOREV, kur, kaldir, kurulu, duraklat, surdur, dosyalar, baslaticiIcerik, gorevXml, kurIcerik, kaldirIcerik };
