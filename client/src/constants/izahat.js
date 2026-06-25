// Vega/Arctos ERP — TBLCARIHAREKETLERI izahat kodları
// Canlı DB doğrulaması (F0101, EVRAKNO=BELGENO join): 21=Satış Faturası,
// 20=Alış Faturası %100 eşleşti. Eski "21-24=Çek/Senet, 13/14=Visa" haritası
// YANLIŞTI — çek/senet kendi tablolarında (TBLCEK*/TBLSENET*), 14/24 hiç yok.
export const IZAHAT_MAP = {
  11: { label: "Cari Çıkış / Tediye", group: "Giden (Borç)", isDevir: false },
  13: { label: "Cari Giriş / Tahsilat", group: "Gelen (Alacak)", isDevir: false },
  20: { label: "Alış Faturası", group: "Gelen (Alacak)", isDevir: false },
  21: { label: "Satış Faturası", group: "Giden (Borç)", isDevir: false },
  22: { label: "Alış İade", group: "Gelen (Alacak)", isDevir: false },
  23: { label: "Satış İade", group: "Giden (Borç)", isDevir: false },
  32: { label: "Stok Giriş Fişi", group: "Gelen (Alacak)", isDevir: false },
  33: { label: "Stok Çıkış Fişi", group: "Giden (Borç)", isDevir: false },
  83: { label: "Manuel / Mahsup", group: "Diğer", isDevir: false },
  103: { label: "Cari Devir Giriş Fişi", group: "Devir (Alacak)", isDevir: true },
  104: { label: "Cari Devir Çıkış Fişi", group: "Devir (Borç)", isDevir: true },
};

export function getIzahatDetails(code) {
  return IZAHAT_MAP[code] || { label: `İzahat ${code ?? "?"}`, group: "Diğer", isDevir: false };
}
