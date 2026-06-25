// ═══════════════════════════════════════════════════════════════════════════
//  Vega Sorgu — Electron masaüstü sarmalayıcı
//  • Express sunucu AYNI process'te çalışır; pencere localhost:3001'i yükler.
//  • GitHub Releases'tan otomatik güncelleme (electron-updater).
//  • Pencere (X) → tray'e küçülür; tekrar açılır.
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// electron-updater geç yüklenir (top-level require app'i erken ister, dev'de çöker).
let autoUpdater = null;

const PORT = 3001;
const URL = `http://localhost:${PORT}`;

// Tek örnek kilidi.
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let mainWindow = null;
let tray = null;
let isQuitting = false;
let updateDownloaded = false;
let updateVersion = null;

const userDataDir = app.getPath('userData');

// ─── Sunucuyu aynı process'te başlat ───────────────────────────────────────────
function startServer() {
  process.env.VEGA_BASE_DIR = userDataDir; // config.json buraya (şifreli DB parolası)
  process.env.VEGA_NO_BROWSER = '1';       // tarayıcı açma; Electron penceresi kullanılır
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  require(path.join(__dirname, '..', 'server', 'server.js')); // app.listen tetikler
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(`${URL}/api/status`); if (r.ok) return true; } catch { /* hazır değil */ }
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

// ─── Otomatik güncelleme ───────────────────────────────────────────────────────
function installUpdateNow() {
  isQuitting = true;
  autoUpdater?.quitAndInstall(true, true);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return; // dev'de denetleme yok
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    updateVersion = info.version;
    refreshTrayMenu();
    if (tray) tray.displayBalloon?.({ title: 'Vega Sorgu', content: `Yeni sürüm ${info.version} indirildi. Çıkışta kurulur veya tray'den hemen kurabilirsiniz.` });
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Şimdi Kur ve Yeniden Başlat', 'Sonra'],
        defaultId: 0, cancelId: 1,
        title: 'Güncelleme hazır',
        message: `Yeni sürüm ${info.version} indirildi.`,
      }).then(r => { if (r.response === 0) installUpdateNow(); });
    }
  });
  autoUpdater.on('error', (e) => console.error('[Updater]', e?.message || e));

  autoUpdater.checkForUpdates().catch(() => { /* ağ yoksa sessiz */ });
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

// ─── Pencere + Tray ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 640,
    icon: path.join(__dirname, 'icon.png'),
    title: 'Vega Sorgu — Finansal Raporlama',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  mainWindow.loadURL(URL);
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (tray) tray.displayBalloon?.({ title: 'Vega Sorgu', content: 'Arka planda çalışıyor. Tray simgesinden tekrar açabilirsiniz.' });
    }
  });
}

function refreshTrayMenu() {
  if (!tray) return;
  const showWin = () => { mainWindow ? (mainWindow.show(), mainWindow.focus()) : createWindow(); };
  const items = [
    { label: 'Göster', click: showWin },
    { type: 'separator' },
  ];
  if (updateDownloaded) items.push({ label: `Güncellemeyi Kur (v${updateVersion})`, click: installUpdateNow });
  else if (app.isPackaged) items.push({ label: 'Güncellemeleri Denetle', click: () => autoUpdater?.checkForUpdates().catch(() => {}) });
  items.push(
    { type: 'separator' },
    { label: 'Çıkış', click: () => { isQuitting = true; app.quit(); } },
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('Vega Sorgu');
  refreshTrayMenu();
  tray.on('double-click', () => { mainWindow ? (mainWindow.show(), mainWindow.focus()) : createWindow(); });
}

app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });

app.whenReady().then(async () => {
  startServer();
  createTray();
  setupAutoUpdater();
  const ok = await waitForServer();
  if (!ok) console.error('[Electron] Sunucu başlatılamadı.');
  createWindow();
});

app.on('window-all-closed', () => { /* tray'de kal */ });
app.on('before-quit', () => { isQuitting = true; });
