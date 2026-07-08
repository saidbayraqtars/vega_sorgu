// Vega/Arctos ERP — TBLCARIHAREKETLERI izahat kodları
// Kaynak: projeler/yeni IZAHAT_LABEL (canlı doğrulandı F0101) + bu DB'de
// ampirik eşleştirme (2026-07, F0101 D0017):
//   12 → CARCIKIADEBASLIK 93/93 eşleşti (çıkış iade bordrosu)
//   19 → tutarsız (BORC=ALACAK=0) çek kayıt satırı; TBLCEKHAREKETLERI
//        BELGEIZAHAT=19 verilen çek olaylarıyla örtüşüyor
//   22 → ALFATBASLIK 457/457 (hepsi ALACAK) = Alış İrsaliyesi (alış yönü)
//   27 → SATIRSBASLIK 1/1 (BORC) = Satış İrsaliyesi
//   32 → STKGIRBASLIK 945/945, 33 → STKCIKBASLIK 193/193 (tam eşleşme)
//   83 → banka hareketi 83 BORC toplamı = cari 83 ALACAK toplamı (kuruşu
//        kuruşuna) → müşteri havalesi (banka tahsilat)
// Eski "21-24=Çek/Senet, 13/14=Visa" haritası YANLIŞTI — çek/senet kendi
// tablolarında (TBLCEK*/TBLSENET*), tutar/vade bordro hareketinde.
export const IZAHAT_MAP = {
  11: { label: "Ödeme (Cari Çıkış Bordrosu)", group: "Giden (Borç)", isDevir: false },
  12: { label: "Cari Çıkış İade Bordrosu", group: "Diğer", isDevir: false },
  13: { label: "Tahsilat (Cari Giriş Bordrosu)", group: "Gelen (Alacak)", isDevir: false },
  16: { label: "Çek Ödeme", group: "Giden (Borç)", isDevir: false },
  19: { label: "Verilen Çek Bordrosu", group: "Diğer", isDevir: false },
  20: { label: "Alış Faturası", group: "Gelen (Alacak)", isDevir: false },
  21: { label: "Satış Faturası", group: "Giden (Borç)", isDevir: false },
  22: { label: "Alış İrsaliyesi", group: "Gelen (Alacak)", isDevir: false },
  23: { label: "Satış İade", group: "Giden (Borç)", isDevir: false },
  27: { label: "Satış İrsaliyesi", group: "Giden (Borç)", isDevir: false },
  32: { label: "Stok Giriş Fişi", group: "Gelen (Alacak)", isDevir: false },
  33: { label: "Stok Çıkış Fişi", group: "Giden (Borç)", isDevir: false },
  83: { label: "Havale (Banka Tahsilat)", group: "Gelen (Alacak)", isDevir: false },
  84: { label: "Banka Ödeme", group: "Giden (Borç)", isDevir: false },
  103: { label: "Cari Devir (Alacak)", group: "Devir (Alacak)", isDevir: true },
  104: { label: "Cari Devir (Borç)", group: "Devir (Borç)", isDevir: true },
};

export function getIzahatDetails(code) {
  return IZAHAT_MAP[code] || { label: `İşlem ${code ?? "?"}`, group: "Diğer", isDevir: false };
}

// TBLBANKAHAREKETLERI izahat kodları (banka hesabı aktif hesap: BORC=giriş,
// ALACAK=çıkış). Bu DB'de gözlenen dağılım: 72 yalnız BORC, 73 yalnız ALACAK,
// 83 BORC (cari 83 ile eşleşti), 84 ALACAK, 113/114 devir.
export const BANKA_IZAHAT_MAP = {
  16: "Çek Ödeme",
  72: "Banka Giriş",
  73: "Banka Çıkış",
  83: "Havale (Tahsilat)",
  84: "Banka Ödeme",
  113: "Banka Devir (Borç)",
  114: "Banka Devir (Alacak)",
};

export function getBankaIzahat(code) {
  const n = parseInt(code);
  return BANKA_IZAHAT_MAP[n] || `İşlem ${code ?? "?"}`;
}

// Bordro hareket (TBLCARGIR/CARCIKHAREKET) ödeme tipi kodları — canlı
// doğrulandı: çek adetleri TBLCEKCIKIS ile, senet adetleri TBLSENETCIKIS ile örtüştü.
export const ODEME_TIPI_MAP = {
  1: "Nakit",
  2: "Çek",
  3: "Senet",
  4: "Kredi Kartı",
  6: "Mahsup",
  10: "Diğer",
  11: "Banka / Havale",
};
