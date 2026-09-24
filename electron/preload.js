// Pencereye açılan dar ve tipli köprü (contextIsolation + sandbox). Node erişimi yoktur.

const { contextBridge, ipcRenderer } = require("electron");

const cagir = async (kanal, ...args) => {
  const r = await ipcRenderer.invoke(kanal, ...args);
  if (!r || !r.tamam) throw new Error((r && r.hata) || "İşlem başarısız.");
  return r.veri;
};

contextBridge.exposeInMainWorld("kopru", {
  bilgi: () => cagir("bilgi"),
  test: (ayar) => cagir("test", ayar),
  kaydet: (ayar) => cagir("kaydet", ayar),
  esitle: (tam) => cagir("esitle", !!tam),
  panel: () => cagir("panel"),
  klasor: () => cagir("klasor"),
  giris: (acik) => cagir("giris", !!acik),
  servis: (islem) => cagir("servis", islem === "kaldir" ? "kaldir" : "kur"),
  guncellemeKur: () => cagir("guncelleme-kur"),
  dinle: (fn) => {
    const f = (_e, v) => fn(v);
    ipcRenderer.on("durum", f);
    return () => ipcRenderer.removeListener("durum", f);
  },
  sekme: (fn) => ipcRenderer.on("sekme", (_e, v) => fn(v)),
});
