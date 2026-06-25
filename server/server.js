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

// Cari hareket izleme kodları (ciro+tahsilat+alış+tediye+iade+devir)
const CARI_KODLAR = [11, 13, 20, 21, 22, 23, 103, 104];
const DEVIR_KODLAR = [103, 104];                          // yıl başı açılış (ciroya dahil değil)

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
  console.log(`[Summary] Cari: ${cariHareketTable}, Kasa: ${kasaTable} (firmaNo=${firmaNo}, donemNo=${donemNo})`);

  const [isCariValid, isKasaValid] = await Promise.all([
    validateTableName(cariHareketTable),
    validateTableName(kasaTable),
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

    // ─── Kasa nakit (GELIR / GIDER) ─────────────────────────────
    if (isKasaValid) {
      const req2 = pool.request();
      req2.input("startDate", sql.Date, startDate);
      req2.input("endDate", sql.Date, endDate);
      const kasaRes = await req2.query(`
        SELECT ISNULL(SUM(GELIR), 0) AS gelir, ISNULL(SUM(GIDER), 0) AS gider
        FROM [${kasaTable}]
        WHERE 1 = 1${dateFilter('TARIH')}
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
      // ─── Kasa nakit hareketleri ───────────────────────────────
      if (await validateTableName(kasaTable)) {
        const result = await request.query(`
          SELECT
            TARIH AS ISLEMTARIHI,
            (GELIR - GIDER) AS ALACAK,
            ACIKLAMA,
            BELGEIZAHAT,
            ACIKLAMA AS firmaUnvan
          FROM [${kasaTable}]
          WHERE 1 = 1${dateFilter('TARIH')}
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
    cekGiris: `F${firmaNo}D${donemNo}TBLCEKGIRIS`,
    cekCikis: `F${firmaNo}D${donemNo}TBLCEKCIKIS`,
    senetGiris: `F${firmaNo}D${donemNo}TBLSENETGIRIS`,
    senetCikis: `F${firmaNo}D${donemNo}TBLSENETCIKIS`,
    visaHareket: `F${firmaNo}D${donemNo}TBLVISAHAREKETLERI`,
    stoklar: `F${firmaNo}TBLSTOKLAR`,
    stokHareket: `F${firmaNo}D${donemNo}TBLSTOKHAREKETLERI`,
    satFat: `F${firmaNo}D${donemNo}TBLSATFATHAREKET`,
  };
}

// ─── CARİ: Liste (arama + sayfalama) ─────────────────────────
app.get("/api/cari/list", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, search = "", page = "1" } = req.query;
  if (!firmaNo) return res.status(400).json({ success: false, message: "firmaNo gerekli." });

  const T = tableNames(firmaNo, "0000");
  if (!(await validateTableName(T.cari))) return res.status(404).json({ success: false, message: "Cari tablosu bulunamadı." });

  const pageSize = 25;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const offset = (pageNum - 1) * pageSize;

  try {
    const request = pool.request();
    let where = `WHERE ISNULL(DELETED,0)=0`;
    if (search.trim()) {
      request.input("s", sql.NVarChar, `%${search.trim()}%`);
      where += ` AND (FIRMAADI LIKE @s OR UNVAN LIKE @s OR FIRMAKODU LIKE @s OR CAST(IND AS VARCHAR) LIKE @s)`;
    }
    const countRes = await request.query(`SELECT COUNT(*) AS cnt FROM [${T.cari}] ${where}`);
    const total = countRes.recordset[0].cnt;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, pageSize);
    const result = await request.query(`
      SELECT IND, FIRMAKODU, COALESCE(NULLIF(UNVAN,''), FIRMAADI) AS UNVAN, FIRMAADI,
             ISNULL(BAKIYE,0) AS BAKIYE, PARABIRIMI
      FROM [${T.cari}] ${where}
      ORDER BY FIRMAADI
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
      const o = (await r2.query(`
        SELECT ISNULL(SUM(BORC),0) giris, ISNULL(SUM(ALACAK),0) cikis,
               ISNULL(SUM(BORC-ALACAK),0) net, COUNT(*) islem
        FROM [${T.cariHareket}] WHERE FIRMANO=@ind`)).recordset[0];
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
      ? `LEFT JOIN (SELECT BANKANO, SUM(BORC-ALACAK) bakiye, COUNT(*) hareket FROM [${T.bankaHareket}] GROUP BY BANKANO) h ON h.BANKANO=b.IND`
      : "";
    const result = await pool.request().query(`
      SELECT b.IND, b.ADI, b.KOD, b.SUBE, ISNULL(b.SUBEADI,'') SUBEADI, b.IBAN, b.HESAPNO, b.PARABIRIMI,
             ${hasHareket ? "ISNULL(h.bakiye,0)" : "0"} AS BAKIYE,
             ${hasHareket ? "ISNULL(h.hareket,0)" : "0"} AS HAREKET
      FROM [${T.bankalar}] b ${bakiyeJoin}
      WHERE ISNULL(b.STATUS,1)=1
      ORDER BY b.ADI`);
    // Para birimi bazında: net, nakit (artı bakiyeli hesaplar), kredi (eksi bakiyeli hesaplar)
    const toplam = {}, nakit = {}, kredi = {};
    let aktif = 0;
    for (const r of result.recordset) {
      const pb = r.PARABIRIMI || "TL";
      toplam[pb] = (toplam[pb] || 0) + r.BAKIYE;
      if (r.BAKIYE > 0) nakit[pb] = (nakit[pb] || 0) + r.BAKIYE;
      else if (r.BAKIYE < 0) kredi[pb] = (kredi[pb] || 0) + r.BAKIYE;
      if (r.HAREKET > 0 || r.BAKIYE !== 0) aktif++;
    }
    res.json({ success: true, data: result.recordset, toplam, nakit, kredi, hesapSayisi: aktif });
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
      ORDER BY h.TARIH, h.IND
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
app.get("/api/cek", async (req, res) => {
  if (!requireConnection(req, res)) return;
  const { firmaNo, donemNo, yon = "giris" } = req.query;
  if (!firmaNo || !donemNo) return res.status(400).json({ success: false, message: "firmaNo ve donemNo gerekli." });
  const T = tableNames(firmaNo, donemNo);
  const tbl = yon === "cikis" ? T.cekCikis : T.cekGiris;
  const cari = T.cari;
  if (!(await validateTableName(tbl))) return res.json({ success: true, data: [], count: 0 });
  try {
    const banka = T.bankalar;
    const hasBanka = await validateTableName(banka);
    const result = await pool.request().query(`
      SELECT TOP 1000 ck.IND, ck.BELGENO, ck.KESIDEEDEN, ck.KESIDEYERI, ck.SUBE, ck.KESIDETARIHI,
             ck.BANKAHESAPNO, ck.EVRAKNO, ck.TAKIPNO, ck.FIRMANO,
             COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan,
             ${hasBanka ? "b.ADI" : "NULL"} AS bankaAdi
      FROM [${tbl}] ck
      LEFT JOIN [${cari}] c ON c.IND = ck.FIRMANO
      ${hasBanka ? `LEFT JOIN [${banka}] b ON b.IND = ck.BANKA` : ""}
      ORDER BY ck.KESIDETARIHI DESC`);
    res.json({ success: true, data: result.recordset, count: result.recordset.length, yon });
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
  const tbl = yon === "cikis" ? T.senetCikis : T.senetGiris;
  const cari = T.cari;
  if (!(await validateTableName(tbl))) return res.json({ success: true, data: [], count: 0 });
  try {
    const result = await pool.request().query(`
      SELECT TOP 1000 sn.BELGENO, sn.KESIDEEDEN, sn.KESIDETARIHI, sn.VERGIDAIRESI, sn.VERGINO,
             ISNULL(sn.TUTAR,0) AS TUTAR, sn.FIRMANO, COALESCE(NULLIF(c.UNVAN,''), c.FIRMAADI) AS cariUnvan
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
    let dateF = "", mDateF = "";
    if (startDate && endDate) {
      request.input("sd", sql.Date, startDate); request.input("ed", sql.Date, endDate);
      dateF = " AND CAST(sf.TARIH AS DATE) BETWEEN @sd AND @ed";
      mDateF = " AND CAST(TARIH AS DATE) BETWEEN @sd AND @ed";
    }
    let searchF = "";
    if (search.trim()) { request.input("q", sql.NVarChar, `%${search.trim()}%`); searchF = " AND (sf.MALINCINSI LIKE @q OR sf.STOKKODU LIKE @q)"; }

    // ─── COGS satış-çıkış izahat kodunu OTOMATİK tespit ──────────
    // Stok hareket satış-çıkış kodu firmaya göre değişir (bu DB=33, başka=21).
    // Doğru kodu bul: cost-değerli (BIRIMFIYAT≈BIRIMMALIYET), satılan stoklarla
    // örtüşen, devir/iade hariç stok-çıkışlarından en yüksek tutarlı. Örtüşme
    // şartı üretim sarfını (hammadde, satışla örtüşmez) eler.
    let salesOutCode = IZ.SATIS; // güvenli varsayılan
    if (await validateTableName(T.stokHareket)) {
      const det = await pool.request().query(`
        SELECT TOP 1 CAST(sh.IZAHAT AS INT) code
        FROM [${T.stokHareket}] sh
        WHERE sh.CIKAN>0 AND ISNULL(sh.IADE,0)=0
          AND CAST(sh.IZAHAT AS INT) NOT IN (${IZ.DEVIR_GIRIS},${IZ.DEVIR_CIKIS})
          AND ABS(ISNULL(sh.BIRIMFIYAT,0)-ISNULL(sh.BIRIMMALIYET,0))<0.01
          AND EXISTS (SELECT 1 FROM [${T.satFat}] sf WHERE sf.STOKNO=sh.STOKNO)
        GROUP BY sh.IZAHAT ORDER BY SUM(sh.TUTAR) DESC`);
      if (det.recordset.length) salesOutCode = det.recordset[0].code;
    }

    // Gelir: satış faturası (GERCEKTOPLAM). Maliyet: tespit edilen satış-çıkış
    // kodundaki hareketler; bu satırlarda TUTAR = miktar × birim maliyet (COGS).
    const result = await request.query(`
      WITH gelir AS (
        SELECT STOKNO, MAX(MALINCINSI) malincinsi, MAX(STOKKODU) stokkodu,
               SUM(MIKTAR) miktar, SUM(GERCEKTOPLAM) satis
        FROM [${T.satFat}] sf WHERE 1=1 ${dateF} ${searchF} GROUP BY STOKNO
      ),
      maliyet AS (
        SELECT STOKNO, SUM(TUTAR) maliyet, SUM(CIKAN) cikan
        FROM [${T.stokHareket}] WHERE IZAHAT='${salesOutCode}' AND CIKAN>0 AND ISNULL(IADE,0)=0 ${mDateF}
        GROUP BY STOKNO
      )
      SELECT TOP 500 g.STOKNO, g.malincinsi, g.stokkodu, g.miktar, g.satis,
             ISNULL(m.maliyet,0) maliyet,
             CASE WHEN g.miktar<>0 THEN ISNULL(m.maliyet,0)/g.miktar ELSE 0 END birimMaliyet,
             (g.satis - ISNULL(m.maliyet,0)) kar
      FROM gelir g LEFT JOIN maliyet m ON m.STOKNO=g.STOKNO
      ORDER BY g.satis DESC`);

    const ozet = result.recordset.reduce((a, r) => {
      a.satis += r.satis || 0; a.maliyet += r.maliyet || 0; a.kar += r.kar || 0; return a;
    }, { satis: 0, maliyet: 0, kar: 0 });
    ozet.marj = ozet.satis ? (ozet.kar / ozet.satis) * 100 : 0;
    ozet.maliyetKodu = salesOutCode; // hangi izahat kodundan COGS alındı

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
    const out = { bankaToplam: {}, bankaNakit: {}, bankaKredi: {}, hesapSayisi: 0, cekSayisi: 0, senetSayisi: 0, tahsilatSayisi: 0, tahsilatToplam: 0 };

    if (await validateTableName(T.bankalar) && await validateTableName(T.bankaHareket)) {
      // Hesap bazında bakiye → para birimi bazında net / nakit (artı) / kredi (eksi)
      const b = await pool.request().query(`
        SELECT b.PARABIRIMI, ISNULL(h.bakiye,0) bakiye, ISNULL(h.hareket,0) hareket
        FROM [${T.bankalar}] b
        LEFT JOIN (SELECT BANKANO, SUM(BORC-ALACAK) bakiye, COUNT(*) hareket FROM [${T.bankaHareket}] GROUP BY BANKANO) h ON h.BANKANO=b.IND
        WHERE ISNULL(b.STATUS,1)=1`);
      b.recordset.forEach(r => {
        const pb = r.PARABIRIMI || "TL";
        out.bankaToplam[pb] = (out.bankaToplam[pb] || 0) + r.bakiye;
        if (r.bakiye > 0) out.bankaNakit[pb] = (out.bankaNakit[pb] || 0) + r.bakiye;
        else if (r.bakiye < 0) out.bankaKredi[pb] = (out.bankaKredi[pb] || 0) + r.bakiye;
        if (r.hareket > 0 || r.bakiye !== 0) out.hesapSayisi++;
      });
    }
    if (await validateTableName(T.cekGiris)) out.cekSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.cekGiris}]`)).recordset[0].n;
    if (await validateTableName(T.senetGiris)) out.senetSayisi = (await pool.request().query(`SELECT COUNT(*) n FROM [${T.senetGiris}]`)).recordset[0].n;
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

  // Tarayıcıyı otomatik aç
  const url = `http://localhost:${PORT}`;
  const startCmd = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
  require('child_process').exec(`${startCmd} ${url}`);
});
