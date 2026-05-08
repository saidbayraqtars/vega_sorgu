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
    // ║  Smart Discovery: TBLFIRMA ve TBLDONEMLER               ║
    // ║  tablolarını oku ve frontend'e gönder                   ║
    // ╚═══════════════════════════════════════════════════════════╝
    const request = pool.request();
    
    // Firma bilgilerini çek
    const firmalarResult = await request.query(`
      SELECT FIRMANO, FIRMAADI
      FROM TBLFIRMA
      ORDER BY FIRMANO
    `);
    
    // Dönem bilgilerini çek
    const donemlerResult = await request.query(`
      SELECT DONEMNO, BASLANGICTARIHI, BITISTARIHI
      FROM TBLDONEMLER
      ORDER BY DONEMNO
    `);

    const firmalar = firmalarResult.recordset;
    const donemler = donemlerResult.recordset;

    res.json({
      success: true,
      message: `${database} veritabanına başarıyla bağlanıldı.`,
      firmalar,
      donemler,
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
// ═══════════════════════════════════════════════════════════════
app.get("/api/summary", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { date, firmaNo, donemNo, subeKodu } = req.query;

  if (!date || !firmaNo || !donemNo || subeKodu === undefined) {
    return res.status(400).json({ success: false, message: "Tarih, firmaNo, donemNo ve subeKodu parametreleri gerekli." });
  }

  const kasaTable = `F${firmaNo}TBLKASA`;
  const cariTable = `F${firmaNo}${donemNo}TBLCARIHAREKETLERI`;

  // Tablo adlarını doğrula (SQL Injection koruması)
  const isKasaValid = await validateTableName(kasaTable);
  const isCariValid = await validateTableName(cariTable);

  try {
    const request = pool.request();
    request.input("date", sql.Date, date);
    request.input("subeKodu", sql.NVarChar, subeKodu);

    let toplamNakit = 0;
    let toplamVisa = 0;

    if (isKasaValid) {
      const nakitQuery = `
        SELECT ISNULL(SUM(TUTAR), 0) AS toplamNakit
        FROM [${kasaTable}]
        WHERE CAST(TARIH AS DATE) = @date
          AND SUBE_KODU = @subeKodu
      `;
      const result = await request.query(nakitQuery);
      if (result.recordset.length > 0) {
        toplamNakit = result.recordset[0].toplamNakit;
      }
    }

    if (isCariValid) {
      const visaQuery = `
        SELECT ISNULL(SUM(ALACAK), 0) AS toplamVisa
        FROM [${cariTable}]
        WHERE IZAHAT = 13
          AND CAST(ISLEMTARIHI AS DATE) = @date
          AND SUBE_KODU = @subeKodu
      `;
      const result = await request.query(visaQuery);
      if (result.recordset.length > 0) {
        toplamVisa = result.recordset[0].toplamVisa;
      }
    }

    res.json({
      success: true,
      data: {
        toplamNakit,
        toplamVisa,
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
// ═══════════════════════════════════════════════════════════════
app.get("/api/details", async (req, res) => {
  if (!requireConnection(req, res)) return;

  const { date, firmaNo, donemNo, subeKodu } = req.query;

  if (!date || !firmaNo || !donemNo || subeKodu === undefined) {
    return res.status(400).json({ success: false, message: "Tarih, firmaNo, donemNo ve subeKodu parametreleri gerekli." });
  }

  const kasaTable = `F${firmaNo}TBLKASA`;
  const cariTable = `F${firmaNo}${donemNo}TBLCARIHAREKETLERI`;

  const isKasaValid = await validateTableName(kasaTable);
  const isCariValid = await validateTableName(cariTable);

  try {
    const request = pool.request();
    request.input("date", sql.Date, date);
    request.input("subeKodu", sql.NVarChar, subeKodu);

    const details = [];

    if (isKasaValid) {
      const nakitQuery = `
        SELECT TARIH AS ISLEMTARIHI, TUTAR AS ALACAK, 83 AS IZAHAT
        FROM [${kasaTable}]
        WHERE CAST(TARIH AS DATE) = @date
          AND SUBE_KODU = @subeKodu
      `;
      const result = await request.query(nakitQuery);
      details.push(...result.recordset);
    }

    if (isCariValid) {
      const visaQuery = `
        SELECT ISLEMTARIHI, ALACAK, IZAHAT
        FROM [${cariTable}]
        WHERE CAST(ISLEMTARIHI AS DATE) = @date
          AND SUBE_KODU = @subeKodu
          AND IZAHAT = 13
      `;
      const result = await request.query(visaQuery);
      details.push(...result.recordset);
    }

    details.sort((a, b) => new Date(a.ISLEMTARIHI) - new Date(b.ISLEMTARIHI));

    res.json({
      success: true,
      data: details,
      count: details.length,
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
