const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");

const app = express();
const PORT = 3001;

// ─── Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// ─── Statik Frontend Dosyaları ───────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Connection Pool (uygulama genelinde tek pool) ────────────
let pool = null;
let currentConfig = null;

// pkg ile derlendiğinde __dirname sanal dosya sistemini gösterir.
// Dosyayı exe'nin yanına kaydetmek için execPath kullanmalıyız.
// Electron VEGA_BASE_DIR=userData verir (config.json oraya yazılır). pkg'de exe
// dizini, dev'de __dirname.
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = process.env.VEGA_BASE_DIR || (isPkg ? path.dirname(process.execPath) : __dirname);
const CONFIG_PATH = path.join(baseDir, "config.json");

// ─── Yardımcı: Şifreleme (PIN YOK) ───────────────────────────
// Şifre config.json içinde sabit anahtarla obfuske edilir (gerçek güvenlik
// değil; parolayı düz metin bırakmamak için). v3 = MAKİNEDEN BAĞIMSIZ sabit
// anahtar → hostname değişse/farklı olsa da config her açılışta çözülür, tekrar
// setup gerekmez. v2 (hostname'e bağlı) eski configleri okumak için tutulur ve
// ilk başarılı bağlantıda v3'e migrate edilir.
const APP_SECRET = "vega-sorgu-static-key-v3-stable-2026";
const APP_SECRET_LEGACY = "vega-sorgu-static-key-v2::" + (os.hostname() || "local");
const keyOf = (secret) => crypto.createHash("sha256").update(secret).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyOf(APP_SECRET), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptWith(secret, text) {
  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyOf(secret), iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Önce v3 sabit anahtar, olmazsa v2 (hostname) — geriye dönük. { text, legacy }.
function decryptEx(text) {
  try { return { text: decryptWith(APP_SECRET, text), legacy: false }; }
  catch { return { text: decryptWith(APP_SECRET_LEGACY, text), legacy: true }; }
}
function decrypt(text) { return decryptEx(text).text; }

// ─── Yardımcı: Pool oluştur ──────────────────────────────────
async function createPool(config) {
  const sqlConfig = {
    user: config.username,
    password: config.password,
    database: config.database,
    server: config.server,
    port: parseInt(config.port) || 1433,
    options: {
      encrypt: false, // Yerel ağda şifreleme gerekmez
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  return await sql.connect(sqlConfig);
}

// ─── Yardımcı: Tablo adı doğrulama (SQL Injection koruması) ──
// includeViews=true → VIEW'ları da kabul et (VARES* çek/senet portföy view'ları için).
async function validateTableName(tableName, includeViews = false) {
  if (!pool || !pool.connected) return false;
  const request = pool.request();
  request.input("tbl", sql.NVarChar, tableName);
  const typeF = includeViews ? "TABLE_TYPE IN ('BASE TABLE','VIEW')" : "TABLE_TYPE = 'BASE TABLE'";
  const result = await request.query(`
    SELECT COUNT(*) AS cnt
    FROM INFORMATION_SCHEMA.TABLES
    WHERE ${typeF} AND TABLE_NAME = @tbl
  `);
  return result.recordset[0].cnt > 0;
}

// ─── Yardımcı: Pool bağlantı kontrolü ────────────────────────
function requireConnection(req, res) {
  if (!pool || !pool.connected) {
    res.status(401).json({ success: false, message: "Veritabanı bağlantısı yok." });
    return false;
  }
  return true;
}

// ─── Yardımcı: Firma + Dönem listesini çek ───────────────────
async function loadFirmaDonem() {
  const request = pool.request();
  const firmalarResult = await request.query(`
    SELECT IND,
           '0' + CAST(IND AS VARCHAR) AS FIRMANO,
           KISAAD AS FIRMAADI
    FROM TBLFIRMA
    ORDER BY IND
  `);
  const firmalar = firmalarResult.recordset.map(f => ({ FIRMANO: f.FIRMANO, FIRMAADI: f.FIRMAADI, IND: f.IND }));

  const donemlerResult = await pool.request().query(`
    SELECT FIND,
           RIGHT('0000' + CAST(IND AS VARCHAR), 4) AS DONEMNO,
           DONEM
    FROM TBLDONEM
    ORDER BY FIND, IND
  `);
  return { firmalar, donemler: donemlerResult.recordset };
}

// ─── Yardımcı: Kayıtlı config ile otomatik bağlan (PIN yok) ───
// Dönüş: { isSetup, connected, needsReconfig?, firmalar?, donemler? }
async function connectFromConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { isSetup: false, connected: false };
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { isSetup: false, connected: false };
  }
  // Eski PIN'li format (pinHash var) → statik anahtarla çözülemez, yeniden kurulum gerekir.
  if (saved.pinHash) return { isSetup: true, connected: false, needsReconfig: true };
  let password, legacy = false;
  try {
    const dec = decryptEx(saved.password);
    password = dec.text; legacy = dec.legacy;
  } catch (err) {
    // Parola hiçbir anahtarla çözülemedi (bozuk config) → yeniden kurulum.
    console.error("Config parola çözme hatası:", err.message);
    return { isSetup: true, connected: false, needsReconfig: true };
  }
  const dbConfig = {
    server: saved.server, database: saved.database,
    username: saved.username, port: saved.port, password,
  };
  // SQL Server açılışta (Windows boot) henüz hazır olmayabilir → birkaç kez dene.
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      if (pool) { await pool.close(); pool = null; }
      pool = await createPool(dbConfig);
      currentConfig = dbConfig;
      const { firmalar, donemler } = await loadFirmaDonem();
      // Eski (hostname) anahtarla çözüldüyse v3 sabit anahtara migrate et.
      if (legacy) saveConfigFile(saved, password);
      return { isSetup: true, connected: true, firmalar, donemler,
               server: saved.server, database: saved.database };
    } catch (err) {
      lastErr = err;
      console.error(`Oto-bağlantı denemesi ${attempt}/4 başarısız:`, err.message);
      if (attempt < 4) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return { isSetup: true, connected: false, message: lastErr?.message };
}

// Config'i v3 anahtarla diske yaz (obfuske parola). pinHash temizlenir.
function saveConfigFile(base, plainPassword) {
  try {
    const out = {
      server: base.server, database: base.database, username: base.username,
      port: base.port, password: encrypt(plainPassword),
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(out, null, 2));
    return true;
  } catch (err) {
    console.error("Config yazma hatası:", err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Açılış — kurulu mu + otomatik bağlan (PIN YOK)
// ═══════════════════════════════════════════════════════════════
app.get("/api/bootstrap", async (req, res) => {
  try {
    if (pool && pool.connected) {
      const { firmalar, donemler } = await loadFirmaDonem();
      return res.json({ success: true, isSetup: true, connected: true, firmalar, donemler,
                        server: currentConfig?.server, database: currentConfig?.database });
    }
    const r = await connectFromConfig();
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, isSetup: fs.existsSync(CONFIG_PATH), connected: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Kurulum Kontrolü (Check Setup) — geri uyumluluk
// ═══════════════════════════════════════════════════════════════
app.get("/api/check-setup", (req, res) => {
  if (fs.existsSync(CONFIG_PATH)) {
    return res.json({ success: true, isSetup: true });
  }
  return res.json({ success: true, isSetup: false });
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: PIN ve Veritabanı Kurulumu (Setup)
// ═══════════════════════════════════════════════════════════════
app.post("/api/setup", async (req, res) => {
  const { server, database, username, password, port } = req.body;

  if (!server || !database || !username || !password) {
    return res.status(400).json({ success: false, message: "Sunucu, veritabanı, kullanıcı adı ve şifre alanlarını doldurunuz." });
  }

  try {
    if (pool) {
      await pool.close();
      pool = null;
    }

    const config = { server, database, username, password, port };
    pool = await createPool(config);
    currentConfig = config;

    const { firmalar, donemler } = await loadFirmaDonem();

    // Ayarları sabit (v3) anahtarla obfuske edip kaydet (PIN yok, makineden bağımsız)
    const saved = saveConfigFile({ server, database, username, port }, password);
    if (!saved) {
      return res.status(500).json({ success: false, message: "Bağlantı bilgileri diske kaydedilemedi. Uygulama yazma izni olan bir klasörde mi?" });
    }

    res.json({
      success: true,
      message: "Kurulum başarılı. Bağlantı bilgileri kaydedildi.",
      firmalar, donemler
    });
  } catch (err) {
    console.error("Setup Hatası:", err);
    res.status(500).json({ success: false, message: "Bağlantı hatası: " + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Ayarları Sıfırla (Reset)
// ═══════════════════════════════════════════════════════════════
app.post("/api/reset", async (req, res) => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
    if (pool) {
      await pool.close();
      pool = null;
    }
    currentConfig = null;
    res.json({ success: true, message: "Ayarlar başarıyla sıfırlandı." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Sıfırlama hatası: " + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Bağlantı Durumu
// ═══════════════════════════════════════════════════════════════
app.get("/api/status", (req, res) => {
  res.json({
    connected: pool !== null && pool.connected,
    database: currentConfig?.database || null,
    server: currentConfig?.server || null,
  });
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Bağlantıyı Kes
// ═══════════════════════════════════════════════════════════════
app.post("/api/disconnect", async (req, res) => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      currentConfig = null;
    }
    res.json({ success: true, message: "Bağlantı kapatıldı." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Vega/Arctos TBLCARIHAREKETLERI standart izahat kodları ──
// Canlı doğrulandı (F0101, EVRAKNO=BELGENO join ile): 21=Satış Faturası 2444/2444
// SATFATBASLIK'ta, 20=Alış Faturası 1941/1941 ALFATBASLIK'ta eşleşti.
const IZ = {
  TEDIYE: 11,       // Cari Çıkış / Tediye (BORC) — biz ödedik
  TAHSILAT: 13,     // Cari Giriş / Tahsilat (ALACAK) — ödeme aldık
  ALIS: 20,         // Alış Faturası (ALACAK)
  SATIS: 21,        // Satış Faturası (BORC) — ciro/gelir
  ALIS_IADE: 22,    // Alış İade (ALACAK)
  SATIS_IADE: 23,   // Satış İade (BORC)
  STOK_GIRIS: 32,   // Stok Giriş Fişi (ALACAK)
  STOK_CIKIS: 33,   // Stok Çıkış Fişi (BORC)
  MANUEL: 83,       // Manuel / Mahsup
  DEVIR_GIRIS: 103, // Cari Devir Giriş (açılış)
  DEVIR_CIKIS: 104, // Cari Devir Çıkış (açılış)
};
// NOT: Eski [13,14]=Visa, [21,22,23,24]=Çek/Senet haritası YANLIŞTI. Çek/senet
// kendi tablolarında (TBLCEK*/TBLSENET*). 14 ve 24 bu DB'de hiç yok.

// Cari hareket izleme kodları (ciro+tahsilat+ödeme+alış+iade+devir)
const CARI_KODLAR = [11, 13, 20, 21, 22, 23, 103, 104];
const DEVIR_KODLAR = [103, 104];                          // yıl başı açılış (ciroya dahil değil)

// Verilen çek VARES view VCEKISLEM değeri: "Ödenecek" = henüz ödenmemiş (canlı
// doğrulandı F0101; diğerleri: 'Çek Ödenmiş', 'Bankadan Ödenmiş Çek', 'Çek İade').
const CEK_ODENECEK = "Ödenecek";

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Günlük Özet (Cari Hareket + Kasa Nakit)
// ═══════════════════════════════════════════════════════════════
app.get("/api/summary", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { startDate, endDate, firmaNo, donemNo, allTime } = req.query;

  if ((!allTime && (!startDate || !endDate)) || !firmaNo || !donemNo) {
    return res.status(400).json({ success: false, message: "startDate, endDate (veya allTime), firmaNo ve donemNo parametreleri gerekli." });
  }

  const cariHareketTable = `F${firmaNo}D${donemNo}TBLCARIHAREKETLERI`;
  const kasaTable = `F${firmaNo}D${donemNo}TBLKASA`;
  const tahsilBaslikTable = `F${firmaNo}D${donemNo}TBLTAHSILBASLIK`;
  console.log(`[Summary] Cari: ${cariHareketTable}, Kasa: ${kasaTable} (firmaNo=${firmaNo}, donemNo=${donemNo})`);

  const [isCariValid, isKasaValid, isTahsilBaslikValid] = await Promise.all([
    validateTableName(cariHareketTable),
    validateTableName(kasaTable),
    validateTableName(tahsilBaslikTable),
  ]);

  // Tarih filtresi yardımcısı (TARIH = belge/iş tarihi)
  const dateFilter = (col) =>
    allTime === 'true' ? '' : ` AND CAST(${col} AS DATE) >= @startDate AND CAST(${col} AS DATE) <= @endDate`;

  try {
    let izahatGroup = [];
    let cariNetBakiye = 0; // izlenen kodların net toplamı (devir dahil)
    let ciro = 0;          // Satış Faturası (21) BORC — gerçek gelir
    let tahsilat = 0;      // Cari Giriş/Tahsilat (13) ALACAK
    let alis = 0;          // Alış Faturası (20) ALACAK
    let nakitGelir = 0, nakitGider = 0, nakitNet = 0;

    // ─── Cari hareketler (izahat bazında borç/alacak) ───────────
    if (isCariValid) {
      const req1 = pool.request();
      req1.input("startDate", sql.Date, startDate);
      req1.input("endDate", sql.Date, endDate);
      const result = await req1.query(`
        SELECT CAST(IZAHAT AS INT) AS code,
               ISNULL(SUM(BORC), 0)   AS borc,
               ISNULL(SUM(ALACAK), 0) AS alacak,
               ISNULL(SUM(ALACAK - BORC), 0) AS total
        FROM [${cariHareketTable}]
        WHERE IZAHAT IN (${CARI_KODLAR.join(',')})${dateFilter('TARIH')}
        GROUP BY IZAHAT
      `);
      izahatGroup = result.recordset;
      cariNetBakiye = izahatGroup.reduce((s, r) => s + r.total, 0);
      const codeSum = (code, field) => izahatGroup.filter(r => r.code === code).reduce((s, r) => s + (r[field] || 0), 0);
      ciro = codeSum(IZ.SATIS, 'borc');        // satış faturası borç = gelir
      tahsilat = codeSum(IZ.TAHSILAT, 'alacak'); // tahsilat alacak
      alis = codeSum(IZ.ALIS, 'alacak');         // alış faturası alacak
    }

    // ─── Kasa nakit (GELIR / GIDER) — Arctos: ISLEMTIPI=1, KREDIKASA hariç, /KUR ──
    if (isKasaValid) {
      const req2 = pool.request();
      req2.input("startDate", sql.Date, startDate);
      req2.input("endDate", sql.Date, endDate);
      const nakitWhere = kasaNakitWhere(tahsilBaslikTable, isTahsilBaslikValid);
      const kasaRes = await req2.query(`
        SELECT ISNULL(SUM(GELIR/${KURX}), 0) AS gelir, ISNULL(SUM(GIDER/${KURX}), 0) AS gider
        FROM [${kasaTable}] K
        WHERE ${nakitWhere}${dateFilter('TARIH')}
      `);
      nakitGelir = kasaRes.recordset[0].gelir;
      nakitGider = kasaRes.recordset[0].gider;
      nakitNet = nakitGelir - nakitGider;
    }

    // ─── Gerçek cari pozisyonu (TBLCARI bakiyeleri, dönemden bağımsız) ───
    // Pozitif bakiye = alacağımız (müşteri borçlu), negatif = borcumuz (tedarikçi).
    let cariAlacak = 0, cariBorc = 0, cariNet = 0;
    const cariTable = `F${firmaNo}TBLCARI`;
    if (await validateTableName(cariTable)) {
      const cr = await pool.request().query(`
        SELECT
          ISNULL(SUM(CASE WHEN BAKIYE > 0 THEN BAKIYE ELSE 0 END), 0) AS alacak,
          ISNULL(SUM(CASE WHEN BAKIYE < 0 THEN BAKIYE ELSE 0 END), 0) AS borc,
          ISNULL(SUM(BAKIYE), 0) AS net
        FROM [${cariTable}]`);
      cariAlacak = cr.recordset[0].alacak;
      cariBorc = cr.recordset[0].borc;
      cariNet = cr.recordset[0].net;
    }

    res.json({
      success: true,
      data: {
        izahatGroup,
        cariNetBakiye,
        ciro,
        tahsilat,
        alis,
        nakitGelir,
        nakitGider,
        nakitNet,
        cariAlacak,
        cariBorc,
        cariNet,
        startDate,
        endDate,
      },
    });
  } catch (err) {
    console.error("Summary hatası:", err.message);
    return res.status(500).json({ success: false, message: `Sorgu hatası: ${err.message}` });
  }
});

// Kart tipi -> cari izahat kodları eşlemesi (doğrulanmış standart kodlar)
const TYPE_KODLAR = {
  ciro: [IZ.SATIS],       // Satış Faturası (21)
  tahsilat: [IZ.TAHSILAT], // Cari Giriş/Tahsilat (13)
  alis: [IZ.ALIS],        // Alış Faturası (20)
  allTime: CARI_KODLAR,   // devir dahil tüm izlenen kodlar
};
// Tip bazında gösterilecek tutar (işaret): ciro=borç, tahsilat/alış=alacak, diğer=net
function detailAmount(type, r) {
  if (type === 'ciro') return r.BORC;
  if (type === 'tahsilat' || type === 'alis') return r.ALACAK;
  return r.ALACAK - r.BORC;
}

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: İşlem Detayları (type: nakit | visa | cekSenet | ciro | allTime)
// Normalize satır: { ISLEMTARIHI, ALACAK, ACIKLAMA, BELGEIZAHAT, firmaUnvan }
// ═══════════════════════════════════════════════════════════════
app.get("/api/details", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { startDate, endDate, firmaNo, donemNo, allTime } = req.query;
  const type = req.query.type || 'allTime';

  if ((!allTime && (!startDate || !endDate)) || !firmaNo || !donemNo) {
    return res.status(400).json({ success: false, message: "startDate, endDate (veya allTime), firmaNo ve donemNo parametreleri gerekli." });
  }

  const cariHareketTable = `F${firmaNo}D${donemNo}TBLCARIHAREKETLERI`;
  const cariTable = `F${firmaNo}TBLCARI`;
  const kasaTable = `F${firmaNo}D${donemNo}TBLKASA`;
  console.log(`[Details] type=${type} firmaNo=${firmaNo} donemNo=${donemNo}`);

  const dateFilter = (col) =>
    allTime === 'true' ? '' : ` AND CAST(${col} AS DATE) >= @startDate AND CAST(${col} AS DATE) <= @endDate`;

  try {
    const request = pool.request();
    request.input("startDate", sql.Date, startDate);
    request.input("endDate", sql.Date, endDate);
    let details = [];

    if (type === 'nakit') {
      // ─── Kasa nakit hareketleri (Arctos: ISLEMTIPI=1, KREDIKASA hariç, /KUR) ──
      if (await validateTableName(kasaTable)) {
        const tahsilBaslikTable = `F${firmaNo}D${donemNo}TBLTAHSILBASLIK`;
        const hasTB = await validateTableName(tahsilBaslikTable);
        const nakitWhere = kasaNakitWhere(tahsilBaslikTable, hasTB);
        const result = await request.query(`
          SELECT
            TARIH AS ISLEMTARIHI,
            (GELIR - GIDER)/${KURX} AS ALACAK,
            ACIKLAMA,
            BELGEIZAHAT,
            ACIKLAMA AS firmaUnvan
          FROM [${kasaTable}] K
          WHERE ${nakitWhere}${dateFilter('TARIH')}
        `);
        details = result.recordset;
      }
    } else {
      // ─── Cari hareketler ──────────────────────────────────────
      const kodlar = TYPE_KODLAR[type] || CARI_KODLAR;
      if (await validateTableName(cariHareketTable)) {
        const result = await request.query(`
          SELECT
            ch.TARIH AS ISLEMTARIHI,
            ch.BORC, ch.ALACAK,
            ch.EVRAKNO AS ACIKLAMA,
            CAST(ch.IZAHAT AS INT) AS BELGEIZAHAT,
            COALESCE(NULLIF(c.UNVAN, ''), c.FIRMAADI) AS firmaUnvan
          FROM [${cariHareketTable}] ch
          LEFT JOIN [${cariTable}] c ON ch.FIRMANO = c.IND
          WHERE ch.IZAHAT IN (${kodlar.join(',')})${dateFilter('ch.TARIH')}
        `);
        // Tip bazında işaretli tutarı ALACAK alanına yaz (UI bu alanı gösterir)
        details = result.recordset.map(r => ({ ...r, ALACAK: detailAmount(type, r) }));
      }
    }

    details.sort((a, b) => new Date(a.ISLEMTARIHI) - new Date(b.ISLEMTARIHI));

    res.json({ success: true, data: details, count: details.length, startDate, endDate });
  } catch (err) {
    console.error("Details hatası:", err.message);
    return res.status(500).json({ success: false, message: `Sorgu hatası: ${err.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════
//  RAPOR MODÜLLERİ (Cari, Banka, Çek/Senet, Visa, Satış Karlılık)
// ═══════════════════════════════════════════════════════════════

// Ortak: firma/dönem doğrulama + tablo adı kurucu
function tableNames(firmaNo, donemNo) {
  return {
    cari: `F${firmaNo}TBLCARI`,
    cariHareket: `F${firmaNo}D${donemNo}TBLCARIHAREKETLERI`,
    bankalar: `F${firmaNo}TBLBANKALAR`,
    bankaHareket: `F${firmaNo}D${donemNo}TBLBANKAHAREKETLERI`,
    kasa: `F${firmaNo}D${donemNo}TBLKASA`,
    tahsilBaslik: `F${firmaNo}D${donemNo}TBLTAHSILBASLIK`,
    cekGiris: `F${firmaNo}D${donemNo}TBLCEKGIRIS`,
    cekCikis: `F${firmaNo}D${donemNo}TBLCEKCIKIS`,
    senetGiris: `F${firmaNo}D${donemNo}TBLSENETGIRIS`,
    senetCikis: `F${firmaNo}D${donemNo}TBLSENETCIKIS`,
    // Çek/senet TUTAR toplamları için Arctos portföy view'ları (ALINAN=varlık, VERILEN=borç)
    cekAlinan: `F${firmaNo}D${donemNo}VARESALINANCEKLER`,
    cekVerilen: `F${firmaNo}D${donemNo}VARESVERILENCEKLER`,
    senetAlinan: `F${firmaNo}D${donemNo}VARESALINANSENETLER`,
    senetVerilen: `F${firmaNo}D${donemNo}VARESVERILENSENETLER`,
    visaHareket: `F${firmaNo}D${donemNo}TBLVISAHAREKETLERI`,
    stoklar: `F${firmaNo}TBLSTOKLAR`,
    stokHareket: `F${firmaNo}D${donemNo}TBLSTOKHAREKETLERI`,
    satFat: `F${firmaNo}D${donemNo}TBLSATFATHAREKET`,
  };
}

// Cari tablosu kolon keşfi (STATUS=aktif/pasif gibi opsiyonel kolonlar için).
// STATUS: 1=aktif, 2=pasif (Vega standart). Firma bazında cache — her istekte sorgu atmaz.
const _cariColsCache = {};
async function cariColumns(firmaNo) {
  if (_cariColsCache[firmaNo]) return _cariColsCache[firmaNo];
  const rs = await pool.request().input("t", sql.NVarChar, `F${firmaNo}TBLCARI`)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t`);
  const set = new Set(rs.recordset.map(c => c.COLUMN_NAME.toUpperCase()));
  _cariColsCache[firmaNo] = set;
  return set;
}

// ─── Döviz hesabı tespiti ────────────────────────────────────
// Bu DB'de tüm banka/kasa PARABIRIMI='TL' ve KUR≈1 kaydedilmiş; döviz kasaları
// yalnızca hesap ADINDA belli (İÇ KASA EURO/DOLAR/STERLİN/FRANK, HALKBANK-STERLİN).
// Bunları TL nakit toplamından ayırıp kendi para birimiyle listelemek için.
function detectDoviz(name, parabirimi) {
  const pb = (parabirimi || "").trim().toUpperCase();
  // PARABIRIMI bazen sembol olarak kayıtlı (ör. HALKBANK/EURO → '€') → koda çevir
  const SYM = { "€": "EUR", "$": "USD", "£": "GBP", "₺": "TL" };
  const norm = SYM[pb] || pb;
  if (norm && norm !== "TL" && norm !== "TRY") return norm;     // gerçek döviz alanı varsa öncelik
  const s = (name || "").toLocaleUpperCase("tr-TR");
  if (/\bEUR(O)?\b/.test(s)) return "EUR";
  if (/DOLAR|DOLLAR|\bUSD\b/.test(s)) return "USD";
  if (/STERL[İI]N|\bGBP\b|POUND/.test(s)) return "GBP";
  if (/FRANK|\bCHF\b/.test(s)) return "CHF";
  return null; // TL
}

// KUR ile TL'ye normalize eden SQL parçası (KUR 0/NULL → 1 kabul)
const KURX = "ISNULL(NULLIF(KUR,0),1)";

// ─── KASA "Toplam Kasa Bakiyesi" — Arctos ile birebir ────────
// Arctos/Vega canlı SQL izleyici (Extended Events) ile yakalandı:
//   SELECT SUM((GELIR-GIDER)/KUR) ... WHERE ISLEMTIPI=1
//     AND CASE WHEN BELGEIZAHAT=15 THEN (TBLTAHSILBASLIK.OZELKOD3) ELSE '' END <> 'KREDIKASA'
// 1) Değer: (GELIR-GIDER)/KUR (döviz kasa kendi biriminde; TL'de KUR=1 → etkisiz).
// 2) ISLEMTIPI=1: yalnız fiziksel nakit. Tip 2/3 = virman/çek-senet transferi (nakit DEĞİL).
// 3) KREDIKASA hariç: BELGEIZAHAT=15 + bağlı tahsilat başlığı OZELKOD3='KREDIKASA' olan
//    POS/kredi kartı tahsilatları nakde sayılmaz.
// Kasa tablosu sorgularında alias 'K' zorunlu.
const KASA_NAKIT_VAL = `(GELIR-GIDER)/${KURX}`;
function kasaNakitWhere(tahsilBaslikTable, hasTahsilBaslik) {
  const kredikasa = hasTahsilBaslik
    ? ` AND CASE WHEN K.BELGEIZAHAT=15 THEN (SELECT ISNULL(OZELKOD3,'') FROM [${tahsilBaslikTable}] WHERE IND=K.BELGELINK AND BELGETIPI=K.BELGEIZAHAT) ELSE '' END <> 'KREDIKASA'`
    : "";
  return `K.ISLEMTIPI=1${kredikasa}`;
}

// ─── CARİ: Liste (arama + bakiye filtresi + sıralama + sayfalama) ──
// bakiye: borclu (BAKIYE>0, cari bize borçlu) | alacakli (BAKIYE<0, biz borçluyuz) | bakiyesiz
// sort: ad | bakiyeDesc | bakiyeAsc
app.get("/api/cari/list", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, search = "", page = "1", bakiye = "", sort = "", bakiyeli = "" } = req.query;
  if (!firmaNo) return res.status(400).json({ success: false, message: "firmaNo gerekli." });

  const T = tableNames(firmaNo, "0000");
  if (!(await validateTableName(T.cari))) return res.status(404).json({ success: false, message: "Cari tablosu bulunamadı." });

  const pageSize = 25;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const offset = (pageNum - 1) * pageSize;

  try {
    const cols = await cariColumns(firmaNo);
    const request = pool.request();
    let where = `WHERE ISNULL(DELETED,0)=0`;
    // Pasif cari (STATUS=2) hiç listelenmez — kullanıcı isteği.
    if (cols.has("STATUS")) where += ` AND ISNULL(STATUS,1)<>2`;
    if (search.trim()) {
      request.input("s", sql.NVarChar, `%${search.trim()}%`);
      where += ` AND (FIRMAADI LIKE @s OR UNVAN LIKE @s OR FIRMAKODU LIKE @s OR CAST(IND AS VARCHAR) LIKE @s)`;
    }
    if (bakiye === "borclu") where += ` AND ISNULL(BAKIYE,0) > 0.009`;
    else if (bakiye === "alacakli") where += ` AND ISNULL(BAKIYE,0) < -0.009`;
    else if (bakiye === "bakiyesiz") where += ` AND ABS(ISNULL(BAKIYE,0)) <= 0.009`;
    // "Sadece bakiyesi olanlar" tiki — bakiyesiz carileri ele.
    if (bakiyeli === "1") where += ` AND ABS(ISNULL(BAKIYE,0)) > 0.009`;
    const ORDERS = { ad: "FIRMAADI", bakiyeDesc: "ISNULL(BAKIYE,0) DESC, FIRMAADI", bakiyeAsc: "ISNULL(BAKIYE,0) ASC, FIRMAADI" };
    const orderBy = ORDERS[sort] || ORDERS.ad;

    const countRes = await request.query(`SELECT COUNT(*) AS cnt FROM [${T.cari}] ${where}`);
    const total = countRes.recordset[0].cnt;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, pageSize);
    const result = await request.query(`
      SELECT IND, FIRMAKODU, COALESCE(NULLIF(UNVAN,''), FIRMAADI) AS UNVAN, FIRMAADI,
             ISNULL(BAKIYE,0) AS BAKIYE, PARABIRIMI
      FROM [${T.cari}] ${where}
      ORDER BY ${orderBy}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({ success: true, data: result.recordset, total, page: pageNum, pageSize, pageCount: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("cari/list hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CARİ: Detay (özet + hareketler) ─────────────────────────
app.get("/api/cari/detail", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, ind } = req.query;
  if (!firmaNo || !donemNo || !ind) return res.status(400).json({ success: false, message: "firmaNo, donemNo ve ind gerekli." });

  const T = tableNames(firmaNo, donemNo);
  try {
    const r1 = pool.request();
    r1.input("ind", sql.Int, parseInt(ind));
    const kart = (await r1.query(`SELECT TOP 1 * FROM [${T.cari}] WHERE IND=@ind`)).recordset[0];

    let ozet = { giris: 0, cikis: 0, net: 0, islem: 0 };
    let hareketler = [];
    if (await validateTableName(T.cariHareket)) {
      const r2 = pool.request();
      r2.input("ind", sql.Int, parseInt(ind));
      // Bakiye = SUM(BORC-ALACAK), KREDIHESABI satırları hariç (Arctos ile birebir)
      const o = (await r2.query(`
        SELECT ISNULL(SUM(BORC),0) giris, ISNULL(SUM(ALACAK),0) cikis,
               ISNULL(SUM(BORC-ALACAK),0) net, COUNT(*) islem
        FROM [${T.cariHareket}] WHERE FIRMANO=@ind AND ISNULL(OZELKOD,'')<>'KREDIHESABI'`)).recordset[0];
      ozet = o;
      const r3 = pool.request();
      r3.input("ind", sql.Int, parseInt(ind));
      hareketler = (await r3.query(`
        SELECT TOP 500 TARIH, ISLEMTARIHI, IZAHAT, EVRAKNO, BORC, ALACAK, BAKIYE, PARABIRIMI
        FROM [${T.cariHareket}] WHERE FIRMANO=@ind ORDER BY TARIH, IND`)).recordset;
    }
    res.json({ success: true, data: { kart, ozet, hareketler } });
  } catch (err) {
    console.error("cari/detail hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── BANKA: Hesap listesi + bakiye ───────────────────────────
app.get("/api/banka/list", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });

  const T = tableNames(firmaNo, donemNo);
  if (!(await validateTableName(T.bankalar))) return res.status(404).json({ success: false, message: "Banka tablosu bulunamadı." });

  try {
    const hasHareket = await validateTableName(T.bankaHareket);
    const bakiyeJoin = hasHareket
      ? `LEFT JOIN (SELECT BANKANO, SUM((BORC-ALACAK)/${KURX}) bakiye, COUNT(*) hareket FROM [${T.bankaHareket}] GROUP BY BANKANO) h ON h.BANKANO=b.IND`
      : "";
    // Pasif (bu dönemde hiç hareketi olmayan) hesaplar listelenmez — kullanıcı
    // isteği. Hareketi olmayan hesap = h.hareket NULL/0. Tablo yoksa hepsi gösterilir.
    // Arctos ile birebir: MUSBANKA=0 (müşteri bankası hariç), STATUS<>2, bakiye (BORC-ALACAK)/KUR.
    const aktifFilter = hasHareket ? " AND ISNULL(h.hareket,0) > 0" : "";
    const result = await pool.request().query(`
      SELECT b.IND, b.ADI, b.KOD, b.SUBE, ISNULL(b.SUBEADI,'') SUBEADI, b.IBAN, b.HESAPNO, b.PARABIRIMI,
             ${hasHareket ? "ISNULL(h.bakiye,0)" : "0"} AS BAKIYE,
             ${hasHareket ? "ISNULL(h.hareket,0)" : "0"} AS HAREKET
      FROM [${T.bankalar}] b ${bakiyeJoin}
      WHERE ISNULL(b.MUSBANKA,0)=0 AND (b.STATUS<>2 OR b.STATUS IS NULL)${aktifFilter}
      ORDER BY b.ADI`);
    // TL hesaplar: net / nakit (artı) / kredi (eksi). Döviz kasaları (İÇ KASA EURO
    // vb.) ayrı bir 'doviz' kovasında toplanır ve TL toplamına dahil edilmez.
    const toplam = {}, nakit = {}, kredi = {}, doviz = {};
    let aktif = 0;
    for (const r of result.recordset) {
      const dov = detectDoviz(r.ADI, r.PARABIRIMI);
      r.DOVIZ = dov;                       // UI etiketi
      if (r.HAREKET > 0 || r.BAKIYE !== 0) aktif++;
      if (dov) {                           // döviz kasası: ayrı, TL'ye karıştırma
        doviz[dov] = (doviz[dov] || 0) + r.BAKIYE;
        continue;
      }
      toplam.TL = (toplam.TL || 0) + r.BAKIYE;
      if (r.BAKIYE > 0) nakit.TL = (nakit.TL || 0) + r.BAKIYE;
      else if (r.BAKIYE < 0) kredi.TL = (kredi.TL || 0) + r.BAKIYE;
    }
    res.json({ success: true, data: result.recordset, toplam, nakit, kredi, doviz, hesapSayisi: aktif });
  } catch (err) {
    console.error("banka/list hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── BANKA: Hareketler (filtre + sayfalama) ──────────────────
app.get("/api/banka/hareket", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, bankaNo, startDate, endDate, page = "1" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });

  const T = tableNames(firmaNo, donemNo);
  if (!(await validateTableName(T.bankaHareket))) return res.json({ success: true, data: [], total: 0, page: 1, pageCount: 0, toplam: {} });

  const pageSize = 50;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const offset = (pageNum - 1) * pageSize;

  try {
    const request = pool.request();
    let where = "WHERE 1=1";
    if (bankaNo) { request.input("bankaNo", sql.Int, parseInt(bankaNo)); where += " AND h.BANKANO=@bankaNo"; }
    if (startDate && endDate) {
      request.input("sd", sql.Date, startDate); request.input("ed", sql.Date, endDate);
      where += " AND CAST(h.TARIH AS DATE) BETWEEN @sd AND @ed";
    }
    const totRes = await request.query(`
      SELECT COUNT(*) cnt, ISNULL(SUM(h.BORC),0) borc, ISNULL(SUM(h.ALACAK),0) alacak
      FROM [${T.bankaHareket}] h ${where}`);
    const total = totRes.recordset[0].cnt;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, pageSize);
    const result = await request.query(`
      SELECT h.TARIH, h.IZAHAT, h.EVRAKNO, h.BORC, h.ALACAK, h.ACIKLAMA, h.PARABIRIMI,
             b.ADI AS bankaAdi, b.SUBE AS bankaSube
      FROM [${T.bankaHareket}] h
      LEFT JOIN [${T.bankalar}] b ON b.IND=h.BANKANO
      ${where}
      ORDER BY h.TARIH DESC, h.IND DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    res.json({
      success: true, data: result.recordset, total, page: pageNum, pageCount: Math.ceil(total / pageSize),
      toplam: { borc: totRes.recordset[0].borc, alacak: totRes.recordset[0].alacak, net: totRes.recordset[0].borc - totRes.recordset[0].alacak },
    });
  } catch (err) {
    console.error("banka/hareket hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ÇEK / SENET: Liste (yon: giris|cikis) ───────────────────
// Çek/senet TUTAR ve VADE bilgisi TBLCEK*/TBLSENET* tablolarında DEĞİL,
// bordro hareket tablolarındadır (canlı doğrulandı F0101 D0017):
//   verilen → TBLCARCIKHAREKET, alınan → TBLCARGIRHAREKET
//   hr.IZAHAT = ödeme tipi (1=Nakit, 2=Çek, 3=Senet, 4=Kredi Kartı, 11=Banka/Havale)
//   hr.BELGELINK = çek/senet tablosundaki IND, hr.EVRAKNO = bordro BASLIK.IND
function bordroTables(firmaNo, donemNo, yon) {
  const pfx = `F${firmaNo}D${donemNo}TBL${yon === "cikis" ? "CARCIK" : "CARGIR"}`;
  return { hareket: `${pfx}HAREKET`, baslik: `${pfx}BASLIK` };
}

app.get("/api/cek", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, yon = "giris" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  const isVer = yon === "cikis";
  try {
    // Ana kaynak: Arctos VARES portföy view'ı — tutar + tahsil/ödeme durumu içerir.
    // Kolon adları yöne göre değişir (canlı doğrulandı F0101):
    //   Alınan (VARESALINANCEKLER): KESIDEEDEN, BANKASUBE, TAHSILDURUMU, KESIDEYERI, TAKIPNO
    //   Verilen (VARESVERILENCEKLER): KESIDEEDENFIRMAADI, SUBE, VCEKISLEM (KESIDEYERI/TAKIPNO yok)
    const view = isVer ? T.cekVerilen : T.cekAlinan;
    if (await validateTableName(view, true)) {
      const kesideci = isVer ? "KESIDEEDENFIRMAADI" : "KESIDEEDEN";
      const sube = isVer ? "SUBE" : "BANKASUBE";
      const durumCol = isVer ? "VCEKISLEM" : "TAHSILDURUMU";
      const kesideYeri = isVer ? "NULL" : "KESIDEYERI";
      const takip = isVer ? "NULL" : "TAKIPNO";
      // Verilen çekte yalnızca ödenecek (ödenmemiş) olanlar — kullanıcı isteği.
      const odenecekWhere = isVer ? `WHERE VCEKISLEM = N'${CEK_ODENECEK}'` : "";
      const result = await pool.request().query(`
        SELECT TOP 2000 IND, BELGENO, ${kesideci} AS KESIDEEDEN, ${kesideYeri} AS KESIDEYERI,
               ${sube} AS SUBE, KESIDETARIHI, BANKAHESAPNO, ${takip} AS TAKIPNO,
               CAST(ISNULL(TUTAR,0) AS DECIMAL(18,2)) AS TUTAR, VADE, ${durumCol} AS DURUM,
               FIRMAADI AS cariUnvan, BANKAADI AS bankaAdi
        FROM [${view}]
        ${odenecekWhere}
        ORDER BY ISNULL(VADE, KESIDETARIHI) DESC`);
      const toplam = result.recordset.reduce((s, r) => s + (Number(r.TUTAR) || 0), 0);
      return res.json({ success: true, data: result.recordset, count: result.recordset.length, toplam, yon });
    }

    // ─── FALLBACK: view yoksa eski yol (TBLCEK* + bordro; durum yok) ───
    const tbl = isVer ? T.cekCikis : T.cekGiris;
    const cari = T.cari;
    if (!(await validateTableName(tbl))) return res.json({ success: true, data: [], count: 0, toplam: 0, yon });
    const banka = T.bankalar;
    const hasBanka = await validateTableName(banka);
    const colRs = await pool.request().input("t", sql.NVarChar, tbl)
      .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t`);
    const have = new Set(colRs.recordset.map(c => c.COLUMN_NAME.toUpperCase()));
    const takipCol = have.has("TAKIPNO") ? "ck.TAKIPNO" : "NULL AS TAKIPNO";
    const B = bordroTables(firmaNo, donemNo, yon);
    const hasBordro = await validateTableName(B.hareket);
    const bordroApply = hasBordro ? `
      OUTER APPLY (SELECT TOP 1 h.TUTAR, h.VADE FROM [${B.hareket}] h
                   WHERE h.BELGELINK = ck.IND AND h.IZAHAT = 2
                   ORDER BY CASE WHEN h.BELGENO = ck.BELGENO THEN 0 ELSE 1 END, h.IND DESC) hr` : "";
    const result = await pool.request().query(`
      SELECT TOP 1000 ck.IND, ck.BELGENO, ck.KESIDEEDEN, ck.KESIDEYERI, ck.SUBE, ck.KESIDETARIHI,
             ck.BANKAHESAPNO, ck.EVRAKNO, ${takipCol}, ck.FIRMANO,
             ${hasBordro ? "CAST(hr.TUTAR AS DECIMAL(18,2)) AS TUTAR, hr.VADE" : "NULL AS TUTAR, NULL AS VADE"},
             NULL AS DURUM,
             COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan,
             ${hasBanka ? "b.ADI" : "NULL"} AS bankaAdi
      FROM [${tbl}] ck
      LEFT JOIN [${cari}] c ON c.IND = ck.FIRMANO
      ${hasBanka ? `LEFT JOIN [${banka}] b ON b.IND = ck.BANKA` : ""}
      ${bordroApply}
      ORDER BY ${hasBordro ? "ISNULL(hr.VADE, ck.KESIDETARIHI)" : "ck.KESIDETARIHI"} DESC`);
    const toplam = result.recordset.reduce((s, r) => s + (Number(r.TUTAR) || 0), 0);
    res.json({ success: true, data: result.recordset, count: result.recordset.length, toplam, yon });
  } catch (err) {
    console.error("cek hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/senet", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, yon = "giris" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  const isVer = yon === "cikis";
  const cari = T.cari;
  try {
    // Ana kaynak: Arctos VARES senet portföy view'ı — tutar + durum içerir.
    // Kolon adları yöne göre değişir (canlı doğrulandı F0101):
    //   Alınan (VARESALINANSENETLER): KESIDEEDEN, TAHSILDURUMU
    //   Verilen (VARESVERILENSENETLER): SENETVRENEFIRMAADI, VSENETISLEM
    const view = isVer ? T.senetVerilen : T.senetAlinan;
    if (await validateTableName(view, true)) {
      const kesideci = isVer ? "SENETVRENEFIRMAADI" : "KESIDEEDEN";
      const durumCol = isVer ? "VSENETISLEM" : "TAHSILDURUMU";
      const result = await pool.request().query(`
        SELECT TOP 2000 BELGENO, CAST(ISNULL(TUTAR,0) AS DECIMAL(18,2)) AS TUTAR, VADE, TARIH,
               ${kesideci} AS KESIDEEDEN, ${durumCol} AS DURUM, FIRMAADI AS cariUnvan
        FROM [${view}]
        ORDER BY ISNULL(VADE, TARIH) DESC`);
      const toplam = result.recordset.reduce((s, r) => s + (Number(r.TUTAR) || 0), 0);
      return res.json({ success: true, data: result.recordset, count: result.recordset.length, toplam, yon });
    }

    // ─── FALLBACK: view yoksa bordro satırları (IZAHAT=3=senet; durum yok) ───
    const tbl = isVer ? T.senetCikis : T.senetGiris;
    const B = bordroTables(firmaNo, donemNo, yon);
    if (await validateTableName(B.hareket)) {
      const hasBaslik = await validateTableName(B.baslik);
      const hasSn = await validateTableName(tbl);
      const result = await pool.request().query(`
        SELECT TOP 1000 hr.BELGENO, CAST(ISNULL(hr.TUTAR,0) AS DECIMAL(18,2)) AS TUTAR, hr.VADE,
               ${hasBaslik ? "bs.TARIH" : "NULL AS TARIH"},
               ${hasSn ? "sn.KESIDEEDEN, sn.VERGIDAIRESI, sn.VERGINO, sn.KESIDETARIHI" : "NULL AS KESIDEEDEN, NULL AS VERGIDAIRESI, NULL AS VERGINO, NULL AS KESIDETARIHI"},
               NULL AS DURUM,
               hr.FIRMANO, COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan
        FROM [${B.hareket}] hr
        LEFT JOIN [${cari}] c ON c.IND = hr.FIRMANO
        ${hasBaslik ? `LEFT JOIN [${B.baslik}] bs ON bs.IND = hr.EVRAKNO` : ""}
        ${hasSn ? `LEFT JOIN [${tbl}] sn ON sn.IND = hr.BELGELINK` : ""}
        WHERE hr.IZAHAT = 3
        ORDER BY hr.VADE DESC`);
      const toplam = result.recordset.reduce((s, r) => s + (Number(r.TUTAR) || 0), 0);
      return res.json({ success: true, data: result.recordset, count: result.recordset.length, toplam, yon });
    }
    if (!(await validateTableName(tbl))) return res.json({ success: true, data: [], count: 0, toplam: 0, yon });
    const result = await pool.request().query(`
      SELECT TOP 1000 sn.BELGENO, sn.KESIDEEDEN, sn.KESIDETARIHI, sn.VERGIDAIRESI, sn.VERGINO,
             ISNULL(sn.TUTAR,0) AS TUTAR, NULL AS VADE, sn.KESIDETARIHI AS TARIH,
             NULL AS DURUM,
             sn.FIRMANO, COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan
      FROM [${tbl}] sn
      LEFT JOIN [${cari}] c ON c.IND = sn.FIRMANO
      ORDER BY sn.KESIDETARIHI DESC`);
    const toplam = result.recordset.reduce((s, r) => s + (r.TUTAR || 0), 0);
    res.json({ success: true, data: result.recordset, count: result.recordset.length, toplam, yon });
  } catch (err) {
    console.error("senet hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TAHSİLAT/TEDİYE: Cari Giriş (13) + Cari Çıkış (11) ───────
// Eski /api/visa idi; 13 genel tahsilat ("visa" değil). Gerçek visa
// TBLVISAHAREKETLERI'nde ama tutar kolonu yok → cari tek temiz kaynak.
app.get("/api/tahsilat", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, startDate, endDate } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  if (!(await validateTableName(T.cariHareket))) return res.json({ success: true, data: [], toplam: {} });
  try {
    const request = pool.request();
    let where = `WHERE ch.IZAHAT IN (${IZ.TAHSILAT},${IZ.TEDIYE})`;
    if (startDate && endDate) {
      request.input("sd", sql.Date, startDate); request.input("ed", sql.Date, endDate);
      where += " AND CAST(ch.TARIH AS DATE) BETWEEN @sd AND @ed";
    }
    const result = await request.query(`
      SELECT TOP 1000 ch.TARIH, ch.EVRAKNO, ch.IZAHAT, ch.BORC, ch.ALACAK,
             COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan
      FROM [${T.cariHareket}] ch
      LEFT JOIN [${T.cari}] c ON c.IND=ch.FIRMANO
      ${where} ORDER BY ch.TARIH DESC`);
    const borc = result.recordset.reduce((s, r) => s + (r.BORC || 0), 0);
    const alacak = result.recordset.reduce((s, r) => s + (r.ALACAK || 0), 0);
    res.json({ success: true, data: result.recordset, toplam: { borc, alacak, net: alacak - borc } });
  } catch (err) {
    console.error("tahsilat hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SATIŞ KARLILIK ──────────────────────────────────────────
app.get("/api/satis-karlilik", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, startDate, endDate, search = "" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  if (!(await validateTableName(T.satFat))) return res.json({ success: true, data: [], ozet: {} });
  try {
    const request = pool.request();
    let dateF = "", searchF = "";
    if (startDate && endDate) {
      request.input("sd", sql.Date, startDate); request.input("ed", sql.Date, endDate);
      dateF = " AND CAST(sf.TARIH AS DATE) BETWEEN @sd AND @ed";
    }
    if (search.trim()) { request.input("q", sql.NVarChar, `%${search.trim()}%`); searchF = " AND (sf.MALINCINSI LIKE @q OR sf.STOKKODU LIKE @q)"; }

    // ─── Maliyet = satış faturası satırındaki AFIYATI (alış/maliyet fiyatı) ──
    // Vega, her satış satırına o anki birim maliyeti AFIYATI olarak yazar
    // (canlı doğrulandı F0101: 12346/12860 satır dolu, AFIYATI≤FIYATI). Kâr =
    // GERCEKTOPLAM − AFIYATI×MIKTAR − MASRAF. Stok hareket/COGS-kod tahminine gerek yok.
    // NOT: AFIYATI=0 satırlar (hizmet/maliyetsiz) %100 marj görünür — Vega da öyle.
    // Arctos kâr analizi ile birebir (canlı izleyici): STOKTIPI 12/13/14 (hizmet/masraf/
    // promosyon) ve DETAY<>0 (set ürün alt-satırı) HARİÇ; kâr masrafı da düşer.
    const sfF = " AND sf.STOKTIPI NOT IN (12,13,14) AND ISNULL(sf.DETAY,0)=0";
    const result = await request.query(`
      SELECT TOP 500 STOKNO,
             MAX(MALINCINSI) malincinsi, MAX(STOKKODU) stokkodu,
             SUM(MIKTAR) miktar,
             CAST(SUM(GERCEKTOPLAM) AS DECIMAL(18,2)) satis,
             CAST(SUM(ISNULL(AFIYATI,0)*MIKTAR) AS DECIMAL(18,2)) maliyet,
             CAST(SUM(ISNULL(MASRAF,0)) AS DECIMAL(18,2)) masraf,
             CAST(SUM(GERCEKTOPLAM - ISNULL(AFIYATI,0)*MIKTAR - ISNULL(MASRAF,0)) AS DECIMAL(18,2)) kar,
             CASE WHEN SUM(MIKTAR)<>0 THEN CAST(SUM(ISNULL(AFIYATI,0)*MIKTAR)/SUM(MIKTAR) AS DECIMAL(18,2)) ELSE 0 END birimMaliyet
      FROM [${T.satFat}] sf WHERE 1=1 ${dateF} ${searchF}${sfF}
      GROUP BY STOKNO ORDER BY SUM(GERCEKTOPLAM) DESC`);

    // Özet TÜM satırlar üzerinden (tabloda yalnız TOP 500 gösterilir; özet
    // capped olmamalı). Aynı filtreleri ikinci sorguda tekrar bağla.
    const req2 = pool.request();
    if (startDate && endDate) { req2.input("sd", sql.Date, startDate); req2.input("ed", sql.Date, endDate); }
    if (search.trim()) req2.input("q", sql.NVarChar, `%${search.trim()}%`);
    const oz = (await req2.query(`
      SELECT CAST(SUM(GERCEKTOPLAM) AS DECIMAL(18,2)) satis,
             CAST(SUM(ISNULL(AFIYATI,0)*MIKTAR) AS DECIMAL(18,2)) maliyet,
             CAST(SUM(ISNULL(MASRAF,0)) AS DECIMAL(18,2)) masraf,
             CAST(SUM(GERCEKTOPLAM - ISNULL(AFIYATI,0)*MIKTAR - ISNULL(MASRAF,0)) AS DECIMAL(18,2)) kar,
             COUNT(DISTINCT STOKNO) kalemSayisi
      FROM [${T.satFat}] sf WHERE 1=1 ${dateF} ${searchF}${sfF}`)).recordset[0];
    const ozet = {
      satis: Number(oz.satis) || 0, maliyet: Number(oz.maliyet) || 0,
      masraf: Number(oz.masraf) || 0, kar: Number(oz.kar) || 0,
      kalemSayisi: oz.kalemSayisi || 0, gosterilen: result.recordset.length,
      maliyetKaynak: "AFIYATI", // maliyet satış satırı alış fiyatından
    };
    ozet.marj = ozet.satis ? (ozet.kar / ozet.satis) * 100 : 0;        // satış tabanlı marj
    ozet.karOrani = ozet.maliyet ? (ozet.kar / ozet.maliyet) * 100 : 0; // maliyet tabanlı (Arctos KAR)

    res.json({ success: true, data: result.recordset, ozet });
  } catch (err) {
    console.error("satis-karlilik hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ANA SAYFA: Özet ─────────────────────────────────────────
app.get("/api/home", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  try {
    const out = {
      kasaNet: 0, kasaKirilim: [],                              // GERÇEK NAKİT (kasa)
      bankaToplam: {}, bankaNakit: {}, bankaKredi: {}, bankaDoviz: {}, hesapSayisi: 0,
      cekSayisi: 0, cekCikisSayisi: 0, senetSayisi: 0, senetCikisSayisi: 0,
      // Çek/senet TUTAR toplamları (VARES portföy view'larından; ALINAN=varlık, VERILEN=borç)
      cekAlinanTutar: 0, cekVerilenTutar: 0, senetAlinanTutar: 0, senetVerilenTutar: 0,
      tahsilatSayisi: 0, tahsilatToplam: 0,
    };

    // ─── GERÇEK NAKİT: Kasa "Toplam Kasa Bakiyesi" — Arctos formülü ──
    // Devir dahil, ISLEMTIPI=1 (yalnız nakit), KREDIKASA hariç, (GELIR-GIDER)/KUR.
    if (await validateTableName(T.kasa)) {
      const hasTB = await validateTableName(T.tahsilBaslik);
      const nakitWhere = kasaNakitWhere(T.tahsilBaslik, hasTB);
      const k = await pool.request().query(`
        SELECT ISNULL(NULLIF(LTRIM(RTRIM(K.KASAADI)),''),'(Tanımsız)') kasa,
               ISNULL(SUM(${KASA_NAKIT_VAL}),0) net
        FROM [${T.kasa}] K WHERE ${nakitWhere}
        GROUP BY K.KASAADI ORDER BY SUM(${KASA_NAKIT_VAL}) DESC`);
      out.kasaKirilim = k.recordset;
      out.kasaNet = k.recordset.reduce((s, r) => s + (r.net || 0), 0);
    }

    if (await validateTableName(T.bankalar) && await validateTableName(T.bankaHareket)) {
      // Hesap bazında net hareket → TL nakit/kredi + döviz kasaları ayrı.
      // Arctos ile birebir: MUSBANKA=0 (müşteri bankası hariç), STATUS<>2, (BORC-ALACAK)/KUR.
      const b = await pool.request().query(`
        SELECT b.ADI, b.PARABIRIMI, ISNULL(h.bakiye,0) bakiye, ISNULL(h.hareket,0) hareket
        FROM [${T.bankalar}] b
        LEFT JOIN (SELECT BANKANO, SUM((BORC-ALACAK)/${KURX}) bakiye, COUNT(*) hareket FROM [${T.bankaHareket}] GROUP BY BANKANO) h ON h.BANKANO=b.IND
        WHERE ISNULL(b.MUSBANKA,0)=0 AND (b.STATUS<>2 OR b.STATUS IS NULL) AND ISNULL(h.hareket,0) > 0`);
      b.recordset.forEach(r => {
        if (r.hareket > 0 || r.bakiye !== 0) out.hesapSayisi++;
        const dov = detectDoviz(r.ADI, r.PARABIRIMI);
        if (dov) { out.bankaDoviz[dov] = (out.bankaDoviz[dov] || 0) + r.bakiye; return; }
        out.bankaToplam.TL = (out.bankaToplam.TL || 0) + r.bakiye;
        if (r.bakiye > 0) out.bankaNakit.TL = (out.bankaNakit.TL || 0) + r.bakiye;
        else if (r.bakiye < 0) out.bankaKredi.TL = (out.bankaKredi.TL || 0) + r.bakiye;
      });
    }
    if (await validateTableName(T.cekGiris)) out.cekSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.cekGiris}]`)).recordset[0].n;
    if (await validateTableName(T.cekCikis)) out.cekCikisSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.cekCikis}]`)).recordset[0].n;
    if (await validateTableName(T.senetGiris)) out.senetSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.senetGiris}]`)).recordset[0].n;
    if (await validateTableName(T.senetCikis)) out.senetCikisSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.senetCikis}]`)).recordset[0].n;
    // Çek/senet TUTAR toplamları — Arctos portföy VIEW'larından SUM(TUTAR)
    // (VARES* birer view olduğu için includeViews=true şart)
    const sumTutar = async (tbl) =>
      (await validateTableName(tbl, true))
        ? (await pool.request().query(`SELECT ISNULL(SUM(TUTAR),0) t FROM [${tbl}]`)).recordset[0].t
        : 0;
    out.cekAlinanTutar = await sumTutar(T.cekAlinan);
    out.cekVerilenTutar = await sumTutar(T.cekVerilen);
    out.senetAlinanTutar = await sumTutar(T.senetAlinan);
    out.senetVerilenTutar = await sumTutar(T.senetVerilen);
    if (await validateTableName(T.cariHareket)) {
      const v = (await pool.request().query(`SELECT COUNT(*) n, ISNULL(SUM(ALACAK),0) t FROM [${T.cariHareket}] WHERE IZAHAT=${IZ.TAHSILAT}`)).recordset[0];
      out.tahsilatSayisi = v.n; out.tahsilatToplam = v.t;
    }
    res.json({ success: true, data: out });
  } catch (err) {
    console.error("home hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SON İŞLEMLER: En güncel cari hareketler (sayfalama) ─────
app.get("/api/son-islemler", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, limit = "10", page = "1" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  if (!(await validateTableName(T.cariHareket))) return res.json({ success: true, data: [], total: 0, page: 1, pageCount: 0 });

  const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 10));
  const pageNum = Math.max(1, parseInt(page) || 1);
  const offset = (pageNum - 1) * pageSize;
  try {
    const totRes = await pool.request().query(`SELECT COUNT(*) cnt FROM [${T.cariHareket}]`);
    const total = totRes.recordset[0].cnt;
    const result = await pool.request()
      .input("offset", sql.Int, offset).input("limit", sql.Int, pageSize)
      .query(`
        SELECT ch.TARIH, ch.IZAHAT, ch.EVRAKNO, ch.BORC, ch.ALACAK,
               COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan
        FROM [${T.cariHareket}] ch
        LEFT JOIN [${T.cari}] c ON c.IND = ch.FIRMANO
        ORDER BY ch.TARIH DESC, ch.IND DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
    res.json({ success: true, data: result.recordset, total, page: pageNum, pageCount: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("son-islemler hatası:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Stok Durumu
// ═══════════════════════════════════════════════════════════════
app.get("/api/stok", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { search } = req.query;
  const stokTable = "TBLSTOK";
  const isStokValid = await validateTableName(stokTable);

  if (!isStokValid) {
    return res.status(404).json({ success: false, message: "TBLSTOK tablosu bulunamadı." });
  }

  try {
    const request = pool.request();
    let query = `
      SELECT TOP 50 STOKKODU, MALINCINSI, 0 AS KALAN
      FROM [${stokTable}]
    `;

    if (search) {
      request.input("search", sql.NVarChar, `%${search}%`);
      query += ` WHERE STOKKODU LIKE @search OR MALINCINSI LIKE @search`;
    }

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Stok hatası:", err.message);
    res.status(500).json({
      success: false,
      message: `Stok sorgu hatası: ${err.message}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Catch-all (React Router için)
// ═══════════════════════════════════════════════════════════════
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Sunucuyu Başlat ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   Arctos ERP — Smart Discovery API Sunucusu    ║
  ║   http://localhost:${PORT}                         ║
  ╠══════════════════════════════════════════════════╣
  ║   Endpoints:                                    ║
  ║   POST /api/connect     (Bağlan + Tablo Keşfi)  ║
  ║   GET  /api/status                              ║
  ║   POST /api/disconnect                          ║
  ║   GET  /api/summary?date=...&table=...          ║
  ║   GET  /api/details?date=...&table=...          ║
  ╚══════════════════════════════════════════════════╝
  `);

  // Kayıtlı config varsa PIN'siz otomatik bağlan (açılışta hazır olsun)
  connectFromConfig()
    .then(r => { if (r.connected) console.log("[Boot] Otomatik bağlandı:", r.database); })
    .catch(() => {});

  // Tarayıcıyı otomatik aç — Electron sarmalayıcıda gerekmez (kendi penceresini açar)
  if (!process.env.VEGA_NO_BROWSER) {
    const url = `http://localhost:${PORT}`;
    const startCmd = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
    require('child_process').exec(`${startCmd} ${url}`);
  }
});
