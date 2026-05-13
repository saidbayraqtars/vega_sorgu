const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

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
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(baseDir, "config.json");

// ─── Yardımcı: Şifreleme Fonksiyonları ───────────────────────
function encrypt(text, pin) {
  const key = crypto.createHash("sha256").update(pin).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text, pin) {
  const key = crypto.createHash("sha256").update(pin).digest();
  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function hashPin(pin) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

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
async function validateTableName(tableName) {
  if (!pool || !pool.connected) return false;
  const request = pool.request();
  request.input("tbl", sql.NVarChar, tableName);
  const result = await request.query(`
    SELECT COUNT(*) AS cnt 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = @tbl
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

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Kurulum Kontrolü (Check Setup)
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
  const { server, database, username, password, port, pin } = req.body;

  if (!server || !database || !username || !password || !pin) {
    return res.status(400).json({ success: false, message: "Tüm alanları ve PIN kodunu doldurunuz." });
  }

  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ success: false, message: "PIN kodu 6 haneli sadece rakamlardan oluşmalıdır." });
  }

  try {
    if (pool) {
      await pool.close();
      pool = null;
    }

    const config = { server, database, username, password, port };
    pool = await createPool(config);
    currentConfig = config;

    const request = pool.request();
    const firmalarResult = await request.query(`
      SELECT IND,
             '0' + CAST(IND AS VARCHAR) AS FIRMANO,
             KISAAD AS FIRMAADI
      FROM TBLFIRMA
      ORDER BY IND
    `);

    const firmalar = firmalarResult.recordset.map(f => ({ FIRMANO: f.FIRMANO, FIRMAADI: f.FIRMAADI, IND: f.IND }));

    const donemlerResult = await request.query(`
      SELECT FIND,
             RIGHT('0000' + CAST(IND AS VARCHAR), 4) AS DONEMNO,
             DONEM
      FROM TBLDONEM
      ORDER BY FIND, IND
    `);

    const donemler = donemlerResult.recordset;

    // Ayarları şifreleyip kaydet
    const savedConfig = {
      server,
      database,
      username,
      port,
      password: encrypt(password, pin),
      pinHash: hashPin(pin)
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(savedConfig, null, 2));

    res.json({
      success: true,
      message: "Kurulum başarılı. Bilgiler güvenli bir şekilde kaydedildi.",
      firmalar, donemler
    });
  } catch (err) {
    console.error("Setup Hatası:", err);
    res.status(500).json({ success: false, message: "Bağlantı hatası: " + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: PIN ile Giriş (Login)
// ═══════════════════════════════════════════════════════════════
app.post("/api/login", async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ success: false, message: "Lütfen PIN kodunuzu giriniz." });
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    return res.status(400).json({ success: false, message: "Sistem kurulu değil, lütfen kurulum yapın." });
  }

  try {
    const fileData = fs.readFileSync(CONFIG_PATH, "utf8");
    const savedConfig = JSON.parse(fileData);

    if (hashPin(pin) !== savedConfig.pinHash) {
      return res.status(401).json({ success: false, message: "Hatalı PIN kodu!" });
    }

    // Şifreyi çöz
    const password = decrypt(savedConfig.password, pin);
    const dbConfig = {
      server: savedConfig.server,
      database: savedConfig.database,
      username: savedConfig.username,
      port: savedConfig.port,
      password
    };

    if (pool) {
      await pool.close();
      pool = null;
    }

    pool = await createPool(dbConfig);
    currentConfig = dbConfig;

    const request = pool.request();
    const firmalarResult = await request.query(`
      SELECT IND,
             '0' + CAST(IND AS VARCHAR) AS FIRMANO,
             KISAAD AS FIRMAADI
      FROM TBLFIRMA
      ORDER BY IND
    `);

    const firmalar = firmalarResult.recordset.map(f => ({ FIRMANO: f.FIRMANO, FIRMAADI: f.FIRMAADI, IND: f.IND }));

    const donemlerResult = await request.query(`
      SELECT FIND,
             RIGHT('0000' + CAST(IND AS VARCHAR), 4) AS DONEMNO,
             DONEM
      FROM TBLDONEM
      ORDER BY FIND, IND
    `);

    const donemler = donemlerResult.recordset;

    res.json({
      success: true,
      message: "Giriş başarılı.",
      firmalar, donemler
    });
  } catch (err) {
    console.error("Login Hatası:", err);
    res.status(500).json({ success: false, message: "Bağlantı veya şifre çözme hatası: " + err.message });
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

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Günlük Özet (Nakit Toplamları)
// ═══════════════════════════════════════════════════════════════
app.get("/api/summary", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { startDate, endDate, firmaNo, donemNo, subeKodu, allTime } = req.query;

  if ((!allTime && (!startDate || !endDate)) || !firmaNo || !donemNo || subeKodu === undefined) {
    return res.status(400).json({ success: false, message: "startDate, endDate (veya allTime), firmaNo, donemNo ve subeKodu parametreleri gerekli." });
  }

  // Tablo adı oluştur: F[FirmaNo]D[DonemNo]TBLKASA (örn: F0101D0003TBLKASA)
  const kasaTable = `F${firmaNo}D${donemNo}TBLKASA`;
  console.log(`[Summary] Kasa tablosu: ${kasaTable} (firmaNo=${firmaNo}, donemNo=${donemNo})`);

  // Tablo adlarını doğrula (SQL Injection koruması)
  const isKasaValid = await validateTableName(kasaTable);

  try {
    const request = pool.request();
    request.input("startDate", sql.Date, startDate);
    request.input("endDate", sql.Date, endDate);
    request.input("subeKodu", sql.NVarChar, subeKodu);

    let toplamNakit = 0;
    // Visa/Cari kısmı iptal edildi

    if (isKasaValid) {
      let nakitQuery = `
        SELECT ISNULL(SUM(GELIR - GIDER), 0) AS toplamNakit
        FROM [${kasaTable}]
      `;
      if (allTime !== 'true') {
        nakitQuery += ` WHERE CAST(TARIH AS DATE) >= @startDate AND CAST(TARIH AS DATE) <= @endDate`;
      }
      const result = await request.query(nakitQuery);
      if (result.recordset.length > 0) {
        toplamNakit = result.recordset[0].toplamNakit;
      }
    }

    res.json({
      success: true,
      data: {
        toplamNakit,
        toplamVisa: 0, // Frontend kırmamak için 0 dönüyoruz
        startDate,
        endDate,
      },
    });
  } catch (err) {
    console.error("Summary hatası:", err.message);

    try {
       const colRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${kasaTable}'`);
       const cols = colRes.recordset.map(r => r.COLUMN_NAME).join(', ');
       return res.status(500).json({
         success: false,
         message: `Sorgu hatası: ${err.message}. Tablo kolonları şunlar: ${cols}`,
       });
    } catch(e) {
       return res.status(500).json({
         success: false,
         message: `Sorgu hatası: ${err.message}`,
       });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Günlük İşlem Detayları
// ═══════════════════════════════════════════════════════════════
app.get("/api/details", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { startDate, endDate, firmaNo, donemNo, subeKodu, allTime } = req.query;

  if ((!allTime && (!startDate || !endDate)) || !firmaNo || !donemNo || subeKodu === undefined) {
    return res.status(400).json({ success: false, message: "startDate, endDate (veya allTime), firmaNo, donemNo ve subeKodu parametreleri gerekli." });
  }

  // Tablo adı oluştur: F[FirmaNo]D[DonemNo]TBLKASA (örn: F0101D0003TBLKASA)
  const kasaTable = `F${firmaNo}D${donemNo}TBLKASA`;
  console.log(`[Details] Kasa tablosu: ${kasaTable} (firmaNo=${firmaNo}, donemNo=${donemNo})`);
  const isKasaValid = await validateTableName(kasaTable);

  try {
    const request = pool.request();
    request.input("startDate", sql.Date, startDate);
    request.input("endDate", sql.Date, endDate);
    request.input("subeKodu", sql.NVarChar, subeKodu);

    const details = [];

    if (isKasaValid) {
      let nakitQuery = `
        SELECT TARIH AS ISLEMTARIHI, (GELIR - GIDER) AS ALACAK, ACIKLAMA AS IZAHAT
        FROM [${kasaTable}]
      `;
      if (allTime !== 'true') {
        nakitQuery += ` WHERE CAST(TARIH AS DATE) >= @startDate AND CAST(TARIH AS DATE) <= @endDate`;
      }
      const result = await request.query(nakitQuery);
      details.push(...result.recordset);
    }

    details.sort((a, b) => new Date(a.ISLEMTARIHI) - new Date(b.ISLEMTARIHI));

    res.json({
      success: true,
      data: details,
      count: details.length,
      startDate,
      endDate,
    });
  } catch (err) {
    console.error("Details hatası:", err.message);
    
    // Hata durumunda tablonun kolonlarını alıp kullanıcıya gösterelim
    try {
       const colRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${kasaTable}'`);
       const cols = colRes.recordset.map(r => r.COLUMN_NAME).join(', ');
       return res.status(500).json({
         success: false,
         message: `Sorgu hatası: ${err.message}. Tablo kolonları şunlar: ${cols}`,
       });
    } catch(e) {
       return res.status(500).json({
         success: false,
         message: `Sorgu hatası: ${err.message}`,
       });
    }
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

  // Tarayıcıyı otomatik aç
  const url = `http://localhost:${PORT}`;
  const startCmd = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
  require('child_process').exec(`${startCmd} ${url}`);
});
