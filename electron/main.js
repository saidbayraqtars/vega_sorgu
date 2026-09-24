// ═══════════════════════════════════════════════════════════════════════════
//  Vega Köprü — Windows tepsi uygulaması (Electron)
//  • Müşteri sunucusunda çalışır: SQL Server'daki Arctos/Vega verisini SALT-OKUNUR okur ve
//    15 dakikada bir Vega Bulut'a (VPS) gönderir. Dışarıdan bağlantı kabul etmez.
//  • Pencere: durum · ayarlar · günlük. Raporlar web panelindedir ("Paneli aç").
//  • Eski "Vega Sorgu" masaüstü uygulamasının yerini alır: aynı appId → otomatik güncellemeyle
//    geçer, eski SQL ayarları (config.json) otomatik alınır; yalnız bulut adresi + anahtar girilir.
//  • Sunucu modu: oturum açılmasa da çalışsın diye SYSTEM hesabıyla Windows görevi (servis.js).
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, Notification, session } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Ayar klasörü sabit: eski sürümle aynı yer (%APPDATA%\vega-sorgu-desktop)
app.setPath("userData", path.join(app.getPath("appData"), "vega-sorgu-desktop"));
if (process.platform === "win32") app.setAppUserModelId("com.vega.sorgu");
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const ROOT = path.join(__dirname, "..");
const { Config } = require(path.join(ROOT, "bridge", "src", "config"));
const { SyncEngine, humanError } = require(path.join(ROOT, "bridge", "src", "sync"));
const { Sql, discover, resolveServer } = require(path.join(ROOT, "bridge", "src", "sql"));
const { Cloud } = require(path.join(ROOT, "bridge", "src", "http"));
const { Logger } = require(path.join(ROOT, "bridge", "src", "logger"));
const kopruPkg = require(path.join(ROOT, "bridge", "package.json"));
const servis = require("./servis");

const ICON = path.join(__dirname, "icon.png");
const CLI = path.join(ROOT, "bridge", "src", "cli.js");
const GIZLI = process.argv.includes("--gizli"); // oturum açılışında pencere açmadan başla

let config = null;
let logger = null;
let engine = null;
let win = null;
let panelWin = null;
let tray = null;
let quitting = false;
let updater = null;
let servisKurulu = false;
let sonDurum = null;
const guncelleme = { durum: "yok", surum: null };

// ─── Eski kurulumdan ayar göçü ─────────────────────────────────────────────
// Eski sürüm config.json'ı userData'ya yazıyordu; klasör adı paketleyiciye göre
// "vega-sorgu-desktop" ya da "Vega Sorgu" olabilir.
function eskiAyariTasi(dir) {
  if (fs.existsSync(path.join(dir, "kopru.json")) || fs.existsSync(path.join(dir, "config.json"))) return;
  const aday = path.join(app.getPath("appData"), "Vega Sorgu", "config.json");
  try {
    if (fs.existsSync(aday)) { fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(aday, path.join(dir, "config.json")); }
  } catch { /* yok */ }
}

// ─── Durum özeti (pencere + tepsi) ─────────────────────────────────────────
function etkinDurum() {
  if (!engine) return { durum: "bekliyor" };
  if (engine.mode === "izleyici") {
    const c = config.state().canli || {};
    return { ...c, izleyici: true, sahip: c.sahip || null };
  }
  return { ...engine.status, sonraki: engine.nextAt, aralikDk: engine.intervalMin };
}

function bilgi() {
  const d = etkinDurum();
  return {
    surum: app.getVersion(), kopruSurum: kopruPkg.version, platform: process.platform, makine: os.hostname(),
    ayarlar: config.public(), hazir: config.ready(),
    mod: engine ? engine.mode : "durdu", durum: d,
    gunluk: logger.tail(200), klasor: config.dir,
    giris: process.platform === "win32" || process.platform === "darwin" ? app.getLoginItemSettings().openAtLogin : null,
    servis: { destek: process.platform === "win32", kurulu: servisKurulu, calisiyor: engine && engine.mode === "izleyici" && d.sahip === "servis" },
    guncelleme,
  };
}

let pushTimer = null;
function yayinla() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const b = bilgi();
    if (win && !win.isDestroyed()) win.webContents.send("durum", b);
    tepsiGuncelle(b);
    bildir(b);
  }, 150);
}

function saatDk(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function durumMetni(b) {
  const d = b.durum || {};
  if (!b.hazir) return "Ayarlar eksik";
  if (d.izleyici) return d.sahip === "servis" ? "Sunucu modu eşitliyor" : "Başka bir köprü eşitliyor";
  if (d.durum === "calisiyor") return "Eşitleniyor…";
  if (d.durum === "hata") return "Hata: eşitlenemedi";
  if (d.durum === "tamam") return `Güncel · ${saatDk(d.son)}`;
  return "Başlıyor…";
}

// Hata bildirimi: yalnız duruma geçişte bir kez
function bildir(b) {
  const d = b.durum || {};
  const yeni = d.durum === "hata" ? `hata:${d.sonHata && d.sonHata.mesaj}` : d.durum;
  if (yeni !== sonDurum && d.durum === "hata" && Notification.isSupported()) {
    new Notification({ title: "Vega Köprü — eşitleme hatası", body: (d.sonHata && d.sonHata.mesaj) || "Bilinmeyen hata", icon: ICON }).show();
  }
  sonDurum = yeni;
}

// ─── Tepsi ─────────────────────────────────────────────────────────────────
function tepsiGuncelle(b = bilgi()) {
  if (!tray) return;
  tray.setToolTip(`Vega Köprü — ${durumMetni(b)}`);
  const items = [
    { label: `Vega Köprü — ${durumMetni(b)}`, enabled: false },
    { type: "separator" },
    { label: "Durumu göster", click: () => pencereAc() },
    { label: "Şimdi eşitle", enabled: b.hazir, click: () => simdiEsitle(false) },
    { label: "Paneli aç", enabled: !!config.data.bulut.url, click: () => paneliAc() },
    { type: "separator" },
  ];
  if (b.giris !== null) items.push({ label: "Oturum açılınca başlat", type: "checkbox", checked: !!b.giris, click: (m) => girisAyarla(m.checked) });
  if (guncelleme.durum === "hazir") items.push({ label: `Güncellemeyi kur (v${guncelleme.surum})`, click: () => guncellemeKur() });
  else if (app.isPackaged) items.push({ label: "Güncellemeleri denetle", click: () => updater && updater.checkForUpdates().catch(() => {}) });
  items.push({ type: "separator" }, { label: "Çıkış", click: () => cikis() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function tepsiOlustur() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on("double-click", () => pencereAc());
  tray.on("click", () => pencereAc());
  tepsiGuncelle();
}

// ─── Pencereler ────────────────────────────────────────────────────────────
function pencereAc(sekme) {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    if (sekme) win.webContents.send("sekme", sekme);
    return;
  }
  win = new BrowserWindow({
    width: 600, height: 760, minWidth: 460, minHeight: 560, show: false, icon: ICON, title: "Vega Köprü",
    autoHideMenuBar: true, backgroundColor: "#f5f6f8",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "ui", "index.html"), sekme ? { query: { sekme } } : undefined);
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
}

function paneliAc() {
  const url = config.data.bulut.url;
  if (!url) { pencereAc("ayarlar"); return; }
  if (panelWin && !panelWin.isDestroyed()) { panelWin.show(); panelWin.focus(); return; }
  const origin = new URL(url).origin;
  panelWin = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 640, icon: ICON, title: "Vega — Panel", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  panelWin.removeMenu();
  const disari = (u) => { try { const x = new URL(u); if (x.protocol === "https:" || x.protocol === "http:") shell.openExternal(u); } catch { /* geçersiz */ } };
  panelWin.webContents.setWindowOpenHandler(({ url: u }) => { disari(u); return { action: "deny" }; });
  panelWin.webContents.on("will-navigate", (e, u) => { if (new URL(u).origin !== origin) { e.preventDefault(); disari(u); } });
  panelWin.loadURL(url);
  panelWin.on("closed", () => { panelWin = null; });
}

// ─── Motor ─────────────────────────────────────────────────────────────────
function motoruBaslat() {
  if (engine) engine.stop();
  engine = new SyncEngine(config, { log: logger, sahip: "tepsi" });
  engine.on("status", () => yayinla());
  if (config.ready()) engine.start();
  yayinla();
}

function simdiEsitle(tam) {
  if (!engine || !config.ready()) return "ayar";
  const r = engine.syncNow(!!tam);
  logger.info(r === "istendi" ? "Eşitleme isteği etkin köprüye iletildi." : `Elle eşitleme başlatıldı${tam ? " (tam)" : ""}.`);
  yayinla();
  return r;
}

// İzleyici modunda canlı durumu dosyadan tazele
setInterval(() => { if (engine && engine.mode === "izleyici") yayinla(); }, 5000).unref();

// ─── Ayar doğrulama (pencereden gelen düz metin) ────────────────────────────
function ayarCoz(a = {}) {
  const patch = {};
  if (a.sql) {
    const s = {};
    if (a.sql.sunucu !== undefined) {
      const { machine, instance } = resolveServer(a.sql.sunucu);
      if (!machine) throw new Error("SQL sunucu adı gerekli (ör. SUNUCU\\SQLEXPRESS).");
      s.server = machine; s.instance = instance;
    }
    if (a.sql.port !== undefined && a.sql.port !== "") {
      const p = Number(a.sql.port);
      if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error("Port 1 ile 65535 arasında olmalı.");
      s.port = p;
    }
    if (a.sql.veritabani !== undefined) s.database = String(a.sql.veritabani).trim() || "VEGADB";
    if (a.sql.kullanici !== undefined) s.user = String(a.sql.kullanici).trim();
    if (a.sql.sifre) s.password = String(a.sql.sifre); // boş = değişmedi
    patch.sql = s;
  }
  if (a.bulut) {
    const b = {};
    if (a.bulut.adres !== undefined) {
      const u = String(a.bulut.adres).trim().replace(/\/+$/, "");
      if (u) {
        let x;
        try { x = new URL(u); } catch { throw new Error("Bulut adresi geçersiz (ör. https://panel.firmaniz.com)."); }
        const yerel = ["localhost", "127.0.0.1"].includes(x.hostname);
        if (x.protocol !== "https:" && !(yerel && x.protocol === "http:")) throw new Error("Bulut adresi https:// ile başlamalı (veri şifreli gitmeli).");
      }
      b.url = u;
    }
    if (a.bulut.anahtar) {
      const k = String(a.bulut.anahtar).trim();
      if (!/^vk_[a-z0-9][a-z0-9-]*_[\w-]{16,}$/.test(k)) throw new Error("Köprü anahtarı 'vk_' ile başlamalı — panelden (Yönetim → Köprü) kopyalayın.");
      b.anahtar = k;
    }
    patch.bulut = b;
  }
  if (a.firmalar !== undefined) {
    patch.firmalar = Array.isArray(a.firmalar) && a.firmalar.length ? a.firmalar.map((f) => String(f).padStart(4, "0")).filter((f) => /^\d{4}$/.test(f)) : null;
  }
  if (a.baslangicYili !== undefined) {
    const y = a.baslangicYili === "" || a.baslangicYili === null ? null : Number(a.baslangicYili);
    if (y !== null && (!Number.isInteger(y) || y < 1990 || y > 2100)) throw new Error("Başlangıç yılı geçersiz.");
    patch.baslangicYili = y;
  }
  if (a.kirliOkuma !== undefined) patch.kirliOkuma = !!a.kirliOkuma;
  return patch;
}

async function baglantiTest(a) {
  const patch = ayarCoz(a);
  const sqlCfg = { ...config.sqlConfig(), ...(patch.sql || {}) };
  const cloudCfg = { ...config.cloud(), ...(patch.bulut || {}) };
  const out = { sql: null, bulut: null };
  await Promise.all([
    (async () => {
      const s = new Sql(sqlCfg);
      try {
        if (!sqlCfg.server || !sqlCfg.user || !sqlCfg.password) throw new Error("SQL sunucu, kullanıcı ve şifre gerekli.");
        const info = await s.info();
        const d = await discover(s);
        out.sql = { ok: true, ...info, donemSayisi: d.donemler.length, firmalar: d.firmalar.map((f) => ({ kod: f.firma, ad: f.ad || f.unvan || f.firma })) };
      } catch (e) {
        out.sql = { ok: false, hata: humanError(e) };
      } finally { await s.close(); }
    })(),
    (async () => {
      try {
        if (!cloudCfg.url) throw new Error("Bulut adresi girilmemiş.");
        if (!cloudCfg.anahtar) throw new Error("Köprü anahtarı girilmemiş.");
        const h = await new Cloud(cloudCfg, { agent: { surum: kopruPkg.version }, timeoutMs: 20000 })
          .hello({ surum: kopruPkg.version, makine: os.hostname() }, { retries: 0 });
        out.bulut = { ok: true, firma: h.firma, aralikDk: h.aralikDk };
      } catch (e) {
        out.bulut = { ok: false, hata: humanError(e) };
      }
    })(),
  ]);
  return out;
}

function girisAyarla(acik) {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({ openAtLogin: !!acik, args: ["--gizli"] });
  config.setState({ girisAyarlandi: true });
  yayinla();
}

async function servisDurumuYenile() {
  servisKurulu = process.platform === "win32" ? await servis.kurulu() : false;
  yayinla();
}

// ─── IPC ───────────────────────────────────────────────────────────────────
function ipc() {
  const handle = (kanal, fn) => ipcMain.handle(kanal, async (e, ...args) => {
    if (!win || e.sender !== win.webContents) throw new Error("Yetkisiz");
    try { return { tamam: true, veri: await fn(...args) }; } catch (err) { return { tamam: false, hata: err.message }; }
  });
  handle("bilgi", () => bilgi());
  handle("test", (a) => baglantiTest(a));
  handle("kaydet", (a) => {
    const patch = ayarCoz(a);
    const oncekiHazir = config.ready();
    config.update(patch);
    logger.info("Ayarlar kaydedildi.");
    if (!config.ready()) { yayinla(); return bilgi(); }
    if (!oncekiHazir || !engine || engine.mode === "durdu") motoruBaslat();
    else simdiEsitle(false);
    return bilgi();
  });
  handle("esitle", (tam) => simdiEsitle(!!tam));
  handle("panel", () => paneliAc());
  handle("klasor", () => shell.openPath(config.dir));
  handle("giris", (acik) => girisAyarla(!!acik));
  handle("servis", async (islem) => {
    if (islem === "kur") {
      if (!config.ready()) throw new Error("Önce ayarları kaydedin.");
      await servis.kur({ exe: process.execPath, cli: CLI, dir: config.dir });
      logger.info("Sunucu modu kuruldu (Windows görevi). Köprü artık oturum açılmasa da çalışır.");
    } else if (islem === "kaldir") {
      await servis.kaldir({ dir: config.dir });
      logger.info("Sunucu modu kaldırıldı.");
    }
    await servisDurumuYenile();
    return bilgi();
  });
  handle("guncelleme-kur", () => guncellemeKur());
}

// ─── Otomatik güncelleme (GitHub Releases) ─────────────────────────────────
function guncellemeKur() {
  if (guncelleme.durum !== "hazir" || !updater) return;
  logger.info(`Güncelleme kuruluyor: v${guncelleme.surum}`);
  if (servisKurulu) servis.duraklat(config.dir); // sunucu modundaki köprü dosyaları bırakmalı
  quitting = true;
  if (engine) engine.stop();
  setTimeout(() => updater.quitAndInstall(true, true), servisKurulu ? 12000 : 200);
}

function guncelleyiciKur() {
  if (!app.isPackaged) return;
  updater = require("electron-updater").autoUpdater;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  updater.on("download-progress", () => { if (guncelleme.durum !== "indiriliyor") { guncelleme.durum = "indiriliyor"; yayinla(); } });
  updater.on("update-downloaded", (info) => {
    guncelleme.durum = "hazir";
    guncelleme.surum = info.version;
    logger.info(`Yeni sürüm indirildi: v${info.version}. Gece 03:00-05:00 arasında ya da siz kurunca yüklenir.`);
    yayinla();
  });
  updater.on("error", (e) => {
    if (guncelleme.durum === "indiriliyor") guncelleme.durum = "yok";
    logger.warn(`Güncelleme denetimi: ${(e && e.message) || e}`);
  });
  const denetle = () => updater.checkForUpdates().catch(() => { /* ağ yok */ });
  denetle();
  setInterval(denetle, 4 * 3600000).unref();
  // Sunucular nadiren yeniden başlar: indirilmiş güncellemeyi gece, eşitleme yokken kur
  setInterval(() => {
    const h = new Date().getHours();
    if (guncelleme.durum === "hazir" && h >= 3 && h < 5 && !(engine && engine.running)) guncellemeKur();
  }, 10 * 60000).unref();
}

async function cikis() {
  if (engine && engine.mode === "etkin" && !servisKurulu) {
    const r = await dialog.showMessageBox({
      type: "warning", buttons: ["Çıkış", "Vazgeç"], defaultId: 1, cancelId: 1, title: "Vega Köprü",
      message: "Köprüyü kapatırsanız veriler buluta gönderilmez.",
      detail: "Panel, köprü yeniden açılana kadar son eşitlenen veriyi gösterir.",
    });
    if (r.response !== 0) return;
  }
  quitting = true;
  app.quit();
}

// ─── Başlangıç ─────────────────────────────────────────────────────────────
app.on("second-instance", () => pencereAc());

app.whenReady().then(async () => {
  // Panel (uzak içerik) ve yerel pencere yalnız panoya kopyalama/tam ekran kullanır; kamera, konum, bildirim… reddedilir
  const IZINLI = new Set(["clipboard-sanitized-write", "fullscreen"]);
  session.defaultSession.setPermissionRequestHandler((_wc, izin, cb) => cb(IZINLI.has(izin)));
  session.defaultSession.setPermissionCheckHandler((_wc, izin) => IZINLI.has(izin));
  const dir = app.getPath("userData");
  eskiAyariTasi(dir);
  config = new Config(dir);
  logger = new Logger(path.join(dir, "kopru.log"));
  logger.on("satir", () => { if (win && !win.isDestroyed() && win.isVisible()) yayinla(); });
  logger.info(`Vega Köprü ${app.getVersion()} başladı (${os.hostname()}).`);
  if (config.migrated) logger.info("Eski Vega Sorgu SQL ayarları alındı; bulut adresi ve köprü anahtarını girin.");
  servis.surdur(dir); // güncelleme bitti: sunucu modundaki köprü devam etsin

  // İlk çalıştırmada oturum açılınca başlat (köprü hep açık olmalı)
  if (!config.state().girisAyarlandi) girisAyarla(true);

  ipc();
  tepsiOlustur();
  motoruBaslat();
  guncelleyiciKur();
  servisDurumuYenile();
  if (!GIZLI || !config.ready()) pencereAc(config.ready() ? undefined : "ayarlar");
});

app.on("window-all-closed", () => { /* tepside kal */ });
app.on("before-quit", () => {
  quitting = true;
  if (engine) engine.stop();
});
