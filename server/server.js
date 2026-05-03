const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");

const app = express();
const PORT = 3001;

// ─── Middleware ────────────────────────────────────────────────
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3001"],
    credentials: true,
  })
);
app.use(express.json());

// ─── Statik Frontend Dosyaları ───────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Connection Pool (uygulama genelinde tek pool) ────────────
let pool = null;
let currentConfig = null;

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
// ENDPOINT: Bağlantı + Otomatik Tablo Keşfi
// ═══════════════════════════════════════════════════════════════
app.post("/api/connect", async (req, res) => {
  const { server, database, username, password, port } = req.body;

  // Validasyon
  if (!server || !database || !username || !password) {
    return res.status(400).json({
      success: false,
      message: "Tüm alanları doldurunuz.",
    });
  }

  try {
    // Eski pool varsa kapat
    if (pool) {
      await pool.close();
      pool = null;
    }

    const config = { server, database, username, password, port };
    pool = await createPool(config);
    currentConfig = config;

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  Smart Discovery: TBLCARIHAREKETLERI ile biten tabloları ║
    // ║  otomatik olarak bul ve frontend'e gönder               ║
    // ╚═══════════════════════════════════════════════════════════╝
    const discovery = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
        AND TABLE_NAME LIKE '%TBLCARIHAREKETLERI'
      ORDER BY TABLE_NAME
    `);

    const tables = discovery.recordset.map((r) => r.TABLE_NAME);

    res.json({
      success: true,
      message: `${database} veritabanına başarıyla bağlanıldı.`,
      tables,
    });
  } catch (err) {
    pool = null;
    currentConfig = null;
    console.error("Bağlantı hatası:", err.message);
    res.status(500).json({
      success: false,
      message: `Bağlantı hatası: ${err.message}`,
    });
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
// ENDPOINT: Günlük Özet (Nakit + Visa Toplamları)
// ─── activeTable frontend'den her istekte gönderilir ──────────
// ═══════════════════════════════════════════════════════════════
app.get("/api/summary", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { date, table } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: "Tarih parametresi gerekli." });
  }
  if (!table) {
    return res.status(400).json({ success: false, message: "Tablo parametresi gerekli. Lütfen bir dönem seçin." });
  }

  // Tablo adını doğrula (SQL Injection koruması)
  const isValid = await validateTableName(table);
  if (!isValid) {
    return res.status(400).json({ success: false, message: `Geçersiz tablo adı: ${table}` });
  }

  try {
    const request = pool.request();
    request.input("date", sql.Date, date);

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  Arctos ERP Sorgu Mantığı:                              ║
    // ║  IZAHAT = 83  → Nakit (Cash)                            ║
    // ║  IZAHAT = 13  → Visa                                    ║
    // ║  ALACAK       → Tutar (Amount)                          ║
    // ║  ISLEMTARIHI  → İşlem Tarihi (Date)                     ║
    // ╚═══════════════════════════════════════════════════════════╝
    const query = `
      SELECT 
        ISNULL(SUM(CASE WHEN IZAHAT = 83 THEN ALACAK ELSE 0 END), 0) AS toplamNakit,
        ISNULL(SUM(CASE WHEN IZAHAT = 13 THEN ALACAK ELSE 0 END), 0) AS toplamVisa
      FROM [${table}]
      WHERE CAST(ISLEMTARIHI AS DATE) = @date
    `;

    const result = await request.query(query);
    const row = result.recordset[0] || { toplamNakit: 0, toplamVisa: 0 };

    res.json({
      success: true,
      data: {
        toplamNakit: row.toplamNakit,
        toplamVisa: row.toplamVisa,
        tarih: date,
      },
    });
  } catch (err) {
    console.error("Summary hatası:", err.message);
    res.status(500).json({
      success: false,
      message: `Sorgu hatası: ${err.message}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT: Günlük İşlem Detayları
// ─── activeTable frontend'den her istekte gönderilir ──────────
// ═══════════════════════════════════════════════════════════════
app.get("/api/details", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { date, table } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: "Tarih parametresi gerekli." });
  }
  if (!table) {
    return res.status(400).json({ success: false, message: "Tablo parametresi gerekli. Lütfen bir dönem seçin." });
  }

  // Tablo adını doğrula
  const isValid = await validateTableName(table);
  if (!isValid) {
    return res.status(400).json({ success: false, message: `Geçersiz tablo adı: ${table}` });
  }

  try {
    const request = pool.request();
    request.input("date", sql.Date, date);

    const query = `
      SELECT 
        ISLEMTARIHI,
        ALACAK,
        IZAHAT
      FROM [${table}]
      WHERE CAST(ISLEMTARIHI AS DATE) = @date
        AND IZAHAT IN (83, 13)
      ORDER BY ISLEMTARIHI ASC
    `;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      tarih: date,
    });
  } catch (err) {
    console.error("Details hatası:", err.message);
    res.status(500).json({
      success: false,
      message: `Sorgu hatası: ${err.message}`,
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
