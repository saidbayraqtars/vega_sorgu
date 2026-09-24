// Vega Köprü penceresi — durum, ayarlar, günlük. Sunucudan/SQL'den gelen metinler
// her zaman textContent ile yazılır (firma adları vb. HTML olarak yorumlanmaz).
"use strict";

const K = window.kopru;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function svg(ad) {
  return `<svg class="ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.SIMGE[ad] || window.SIMGE["circle-help"]}</svg>`;
}
function simgele(root = document) {
  for (const el of root.querySelectorAll("[data-ikon]")) el.innerHTML = svg(el.dataset.ikon);
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function ikonEl(ad) { const s = el("span"); s.innerHTML = svg(ad); return s; }

const saat = (iso) => (iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "");
function once(iso) {
  if (!iso) return "";
  const dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
const sayi = (n) => (Number(n) || 0).toLocaleString("tr-TR");
function boyut(b) {
  b = Number(b) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB`;
  return `${(b / 1048576).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}
const sure = (ms) => `${(Number(ms || 0) / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;

let B = null; // son bilgi
let formDolu = false;
let testFirmalar = null;

// ─── Bildirim ──────────────────────────────────────────────────────────────
let bildirimZaman = null;
function bildir(metin, kotu = false) {
  const b = $("#bildirim");
  b.textContent = metin;
  b.classList.toggle("kotu", kotu);
  b.classList.remove("gizli");
  clearTimeout(bildirimZaman);
  bildirimZaman = setTimeout(() => b.classList.add("gizli"), kotu ? 6000 : 3000);
}

async function is(dugme, fn) {
  if (dugme) { dugme.disabled = true; dugme.classList.add("bekliyor"); }
  try { return await fn(); } catch (e) { bildir(e.message, true); return null; } finally {
    if (dugme) { dugme.disabled = false; dugme.classList.remove("bekliyor"); }
  }
}

// ─── Sekmeler ──────────────────────────────────────────────────────────────
function sekmeAc(ad) {
  for (const b of $$(".sekmeler button")) b.classList.toggle("secili", b.dataset.sekme === ad);
  for (const s of $$(".sayfa")) s.classList.toggle("gizli", s.id !== ad);
  if (ad === "gunluk") gunlukCiz(true);
}
for (const b of $$(".sekmeler button")) b.addEventListener("click", () => sekmeAc(b.dataset.sekme));

// ─── Durum ─────────────────────────────────────────────────────────────────
function durumCiz() {
  const d = B.durum || {};
  const simge = $("#durumSimge");
  let ikon = "hourglass", sinif = "notr", baslik = "Başlıyor…", alt = "";
  if (!B.hazir) {
    ikon = "settings"; sinif = "uyari"; baslik = "Ayarlar eksik";
    alt = "SQL Server ve bulut bilgilerini girip kaydedin.";
  } else if (d.izleyici) {
    ikon = "server"; sinif = d.durum === "hata" ? "kotu" : "iyi";
    baslik = d.sahip === "servis" ? "Sunucu modu çalışıyor" : "Başka bir köprü çalışıyor";
    alt = d.durum === "hata" && d.sonHata ? d.sonHata.mesaj : d.son ? `Son eşitleme ${saat(d.son)} · ${once(d.son)}` : "Eşitleme bu bilgisayardaki arka plan görevinde yapılıyor.";
  } else if (d.durum === "calisiyor") {
    ikon = "refresh-cw"; sinif = "calisiyor"; baslik = "Eşitleniyor";
    alt = (d.ilerleme && d.ilerleme.adim) || "";
  } else if (d.durum === "hata") {
    ikon = "triangle-alert"; sinif = "kotu"; baslik = "Eşitlenemedi";
    alt = (d.sonHata && d.sonHata.mesaj) || "Bilinmeyen hata";
  } else if (d.durum === "tamam") {
    ikon = "circle-check"; sinif = "iyi"; baslik = "Güncel";
    alt = `Son eşitleme ${saat(d.son)} · ${once(d.son)}`;
  }
  simge.className = `durum-simge ${sinif}`;
  simge.innerHTML = svg(ikon);
  $("#durumBaslik").textContent = baslik;
  $("#durumAlt").textContent = alt;
  const ilerleme = d.durum === "calisiyor" && d.ilerleme && !d.izleyici;
  $("#ilerleme").classList.toggle("gizli", !ilerleme);
  if (ilerleme) $("#ilerlemeDolu").style.width = `${Math.max(3, Math.min(100, Number(d.ilerleme.yuzde) || 0))}%`;

  $("#btnEsitle").disabled = !B.hazir || (d.durum === "calisiyor" && !d.izleyici);
  $("#btnPanel").disabled = !B.ayarlar.bulut.url;

  $("#bFirma").textContent = d.firma ? `${d.firma.ad} (${d.firma.kod})` : "—";
  $("#bSonraki").textContent = d.durum === "calisiyor" ? "şimdi" : d.sonraki ? `${saat(d.sonraki)} · her ${d.aralikDk || 15} dk` : "—";
  const s = B.ayarlar.sql;
  $("#bSql").textContent = s.server ? `${s.server}${s.instance ? "\\" + s.instance : ""} · ${s.database}` : "—";
  let host = "—";
  try { if (B.ayarlar.bulut.url) host = new URL(B.ayarlar.bulut.url).host; } catch { /* geçersiz */ }
  const bagli = d.baglanti !== "yok";
  $("#bBulut").textContent = host === "—" ? host : `${host} · ${bagli ? "bağlı" : "bağlantı yok"}`;
  $("#bBulut").className = host === "—" ? "" : bagli ? "iyi" : "kotu";
  $("#bBulutIkon").innerHTML = svg(bagli ? "cloud" : "cloud-off");
  const r = d.sonuc;
  $("#bParca").textContent = r ? `${sayi(r.gonderilen)} / ${sayi(r.parca)} parça değişti` : "—";
  $("#bGonderilen").textContent = r ? `${sayi(r.satir)} satır · ${boyut(r.bayt)} · ${sure(r.sure)}` : "—";

  // Bantlar
  const bantlar = $("#bantlar");
  bantlar.replaceChildren();
  const bant = (ikon2, metin, sinif2, dugme) => {
    const b = el("div", `bant ${sinif2 || ""}`);
    b.append(ikonEl(ikon2), el("div", "metin", metin));
    if (dugme) b.append(dugme);
    bantlar.append(b);
  };
  if (B.guncelleme && B.guncelleme.durum === "hazir") {
    const kur = el("button", "dugme kucuk ana");
    kur.append(ikonEl("download"), document.createTextNode("Şimdi kur"));
    kur.addEventListener("click", () => is(kur, () => K.guncellemeKur()));
    bant("download", `Yeni sürüm hazır (v${B.guncelleme.surum}). Gece kendiliğinden kurulur.`, "", kur);
  }
  if (B.hazir && !B.servis.kurulu && B.servis.destek && B.giris === false) {
    bant("triangle-alert", "Oturum açılınca başlat kapalı: bilgisayar yeniden başlarsa eşitleme durur.", "uyari");
  }
}

// ─── Ayarlar formu ─────────────────────────────────────────────────────────
function formDoldur() {
  const f = $("#form");
  const a = B.ayarlar;
  f.sunucu.value = a.sql.server ? `${a.sql.server}${a.sql.instance ? "\\" + a.sql.instance : ""}` : "";
  f.port.value = a.sql.port || "";
  f.veritabani.value = a.sql.database || "VEGADB";
  f.kullanici.value = a.sql.user || "";
  f.sifre.value = "";
  f.sifre.placeholder = a.sql.password ? "•••••• (kayıtlı — değiştirmek için yazın)" : "";
  f.adres.value = a.bulut.url || "";
  f.anahtar.value = "";
  f.anahtar.placeholder = a.bulut.anahtar ? "•••••• (kayıtlı — değiştirmek için yapıştırın)" : "vk_…";
  f.baslangicYili.value = a.baslangicYili || "";
  f.kirliOkuma.checked = !!a.kirliOkuma;
  formDolu = true;
}

function formOku() {
  const f = $("#form");
  const out = {
    sql: { sunucu: f.sunucu.value, port: f.port.value.trim(), veritabani: f.veritabani.value, kullanici: f.kullanici.value, sifre: f.sifre.value },
    bulut: { adres: f.adres.value, anahtar: f.anahtar.value },
    baslangicYili: f.baslangicYili.value.trim(),
    kirliOkuma: f.kirliOkuma.checked,
  };
  if (testFirmalar) {
    const secili = $$("#firmaListe input:checked").map((i) => i.value);
    out.firmalar = secili.length === testFirmalar.length ? null : secili;
  }
  return out;
}

function ayarBantCiz() {
  const k = $("#ayarBant");
  k.replaceChildren();
  if (B.ayarlar.eskiAyarlarAlindi && !B.hazir) {
    const b = el("div", "bant");
    b.append(ikonEl("info"), el("div", "metin", "Eski Vega Sorgu SQL ayarlarınız alındı. Yalnız bulut adresi ve köprü anahtarını girin."));
    k.append(b);
  }
}

function sonucSatiri(ok, baslik, ayrinti, uyari) {
  const s = el("div", `satir-sonuc ${ok ? (uyari ? "uyari" : "iyi") : "kotu"}`);
  const d = el("div");
  d.append(el("b", null, baslik));
  if (ayrinti) d.append(el("small", null, ayrinti));
  s.append(ikonEl(ok ? (uyari ? "triangle-alert" : "circle-check") : "x"), d);
  return s;
}

function firmaListesiCiz(firmalar) {
  testFirmalar = firmalar;
  const secili = B.ayarlar.firmalar && B.ayarlar.firmalar.length ? new Set(B.ayarlar.firmalar) : null;
  const liste = $("#firmaListe");
  liste.replaceChildren();
  for (const f of firmalar) {
    const l = el("label", "onay");
    const i = el("input");
    i.type = "checkbox"; i.value = f.kod; i.checked = !secili || secili.has(f.kod);
    l.append(i, el("code", null, f.kod), document.createTextNode(` ${f.ad}`));
    liste.append(l);
  }
  $("#firmaAlani").classList.toggle("gizli", firmalar.length < 2);
}

$("#btnTest").addEventListener("click", () => is($("#btnTest"), async () => {
  const k = $("#testSonuc");
  k.replaceChildren(sonucSatiri(true, "Deneniyor…", "SQL Server ve bulut bağlantısı kontrol ediliyor (en fazla 20 sn).", true));
  const r = await K.test(formOku());
  k.replaceChildren();
  if (r.sql.ok) {
    const uyari = r.sql.sysadmin ? " · UYARI: sysadmin yetkili kullanıcı — salt-okunur kullanıcı önerilir" : "";
    k.append(sonucSatiri(true, `SQL Server bağlandı · ${r.sql.veritabani}`, `${r.sql.surum} · kullanıcı ${r.sql.kim} · ${r.sql.firmalar.length} firma, ${r.sql.donemSayisi} dönem${uyari}`, !!r.sql.sysadmin));
    firmaListesiCiz(r.sql.firmalar);
  } else {
    k.append(sonucSatiri(false, "SQL Server'a bağlanılamadı", r.sql.hata));
  }
  k.append(r.bulut.ok
    ? sonucSatiri(true, `Bulut bağlandı · ${r.bulut.firma.ad}`, `Kod: ${r.bulut.firma.kod} · eşitleme aralığı ${r.bulut.aralikDk} dk`)
    : sonucSatiri(false, "Buluta bağlanılamadı", r.bulut.hata));
}));

$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  is($("#btnKaydet"), async () => {
    B = await K.kaydet(formOku());
    formDoldur();
    ciz();
    if (B.hazir) { bildir("Kaydedildi. Eşitleme başlıyor."); sekmeAc("durum"); } else bildir("Kaydedildi. Eksik alanlar var.", true);
  });
});

for (const g of $$(".goz")) {
  g.addEventListener("click", () => {
    const i = $(`#form [name=${g.dataset.hedef}]`);
    const acik = i.type === "password";
    i.type = acik ? "text" : "password";
    g.innerHTML = svg(acik ? "eye-off" : "eye");
  });
}

// ─── Çalışma: oturum açılışı + sunucu modu ─────────────────────────────────
$("#giris").addEventListener("change", (e) => is(null, () => K.giris(e.target.checked)));

function calismaCiz() {
  $("#girisSatir").classList.toggle("gizli", B.giris === null);
  $("#giris").checked = !!B.giris;
  const sv = B.servis;
  $("#servisSatir").classList.toggle("gizli", !sv.destek);
  const btn = $("#btnServis");
  btn.replaceChildren(ikonEl(sv.kurulu ? "trash-2" : "server"), document.createTextNode(sv.kurulu ? "Kaldır" : "Kur"));
  btn.classList.toggle("tehlike", sv.kurulu);
  btn.disabled = !B.hazir && !sv.kurulu;
  $("#servisDurum").textContent = sv.kurulu
    ? (sv.calisiyor ? "Kurulu ve çalışıyor. Bu pencere yalnız durumu gösterir." : "Kurulu. Görev bir sonraki açılışta ya da birkaç saniye içinde başlar.")
    : "Oturum açılmasa da çalışır (Windows görevi, yönetici izni ister).";
}
$("#btnServis").addEventListener("click", () => is($("#btnServis"), async () => {
  const islem = B.servis.kurulu ? "kaldir" : "kur";
  B = await K.servis(islem);
  ciz();
  bildir(islem === "kur" ? "Sunucu modu kuruldu." : "Sunucu modu kaldırıldı.");
}));

// ─── Günlük ────────────────────────────────────────────────────────────────
let gunlukSon = "";
function gunlukCiz(zorla = false) {
  const list = B.gunluk || [];
  const imza = list.length ? `${list.length}|${list[list.length - 1].zaman}` : "";
  if (!zorla && imza === gunlukSon) return;
  gunlukSon = imza;
  const ol = $("#gunlukListe");
  const altta = ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 30;
  ol.replaceChildren(...list.map((k) => {
    const li = el("li", `g-${k.seviye}`);
    const t = el("time", null, new Date(k.zaman).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    li.append(t, el("span", null, k.mesaj));
    return li;
  }));
  if (altta || zorla) ol.scrollTop = ol.scrollHeight;
}
$("#btnKlasor").addEventListener("click", () => is($("#btnKlasor"), () => K.klasor()));
$("#btnTam").addEventListener("click", () => is($("#btnTam"), async () => {
  await K.esitle(true);
  bildir("Tam eşitleme başlatıldı; tüm veri yeniden gönderilecek.");
}));

// ─── Genel ─────────────────────────────────────────────────────────────────
$("#btnEsitle").addEventListener("click", () => is($("#btnEsitle"), async () => {
  const r = await K.esitle(false);
  bildir(r === "istendi" ? "İstek arka plan görevine iletildi (≤ 10 sn)." : "Eşitleme başladı.");
}));
$("#btnPanel").addEventListener("click", () => is($("#btnPanel"), () => K.panel()));

function ciz() {
  if (!B) return;
  $("#surum").textContent = `v${B.surum}`;
  durumCiz();
  ayarBantCiz();
  calismaCiz();
  if (!$("#gunluk").classList.contains("gizli")) gunlukCiz();
}

async function basla() {
  simgele();
  const q = new URLSearchParams(location.search);
  B = await K.bilgi();
  formDoldur();
  ciz();
  if (q.get("sekme")) sekmeAc(q.get("sekme"));
  K.dinle((b) => { B = b; if (!formDolu) formDoldur(); ciz(); });
  K.sekme((s) => sekmeAc(s));
  setInterval(() => { if (B) durumCiz(); }, 30000); // "3 dk önce" metinleri
}
basla().catch((e) => bildir(e.message, true));
