// Vega/Arctos ERP — TBLCARIHAREKETLERI izahat kodları (Excel haritası + DB doğrulaması)
export const IZAHAT_MAP = {
  13: { label: "Visa Tahsilat", group: "Gelen (Alacak)", isDevir: false },
  14: { label: "Visa Ödeme/İade", group: "Giden (Borç)", isDevir: false },
  21: { label: "Gelen Çek", group: "Gelen (Alacak)", isDevir: false },
  22: { label: "Giden Çek", group: "Giden (Borç)", isDevir: false },
  23: { label: "Gelen Senet", group: "Gelen (Alacak)", isDevir: false },
  24: { label: "Giden Senet", group: "Giden (Borç)", isDevir: false },
  103: { label: "Cari Devir Giriş Fişi", group: "Devir (Alacak)", isDevir: true },
  104: { label: "Cari Devir Çıkış Fişi", group: "Devir (Borç)", isDevir: true },
};

export function getIzahatDetails(code) {
  return IZAHAT_MAP[code] || { label: `İzahat ${code ?? "?"}`, group: "Diğer", isDevir: false };
}
