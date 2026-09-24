// Demo veri için Türkçe ad listeleri.

const ON = ["Anadolu", "Karadeniz", "Ege", "Marmara", "Akdeniz", "Toros", "Kuzey", "Güney", "Yıldız", "Doğan", "Atlas", "Kartal",
  "Çınar", "Umut", "Birlik", "Güven", "Özgür", "Yeşil", "Mavi", "Altın", "Gümüş", "Demir", "Bereket", "Asya", "Pınar", "Deniz",
  "Nehir", "Işık", "Ufuk", "Zirve", "Park", "Sahil", "Kent", "Liman", "Vadi", "Ova", "Tepe", "Köprü", "Kale", "Yol"];
const SOYAD = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aslan",
  "Çetin", "Kara", "Koç", "Kurt", "Özdemir", "Şimşek", "Polat", "Erdoğan", "Aksoy", "Güneş", "Bulut", "Tekin", "Karaca"];
const SEKTOR = ["Gıda", "Tekstil", "Yapı", "Otomotiv", "Elektrik", "Tarım", "Kırtasiye", "Temizlik", "Ambalaj", "Mobilya",
  "Plastik", "Kimya", "Medikal", "Bilişim", "Market", "Lojistik", "Enerji", "Makine", "Hırdavat", "Kozmetik"];
const EK = ["Ltd. Şti.", "A.Ş.", "San. ve Tic. Ltd. Şti.", "Tic. Ltd. Şti.", "Pazarlama", "Ticaret", "Market", "Gross"];
const ILLER = [
  ["İstanbul", 30], ["Ankara", 12], ["İzmir", 10], ["Bursa", 7], ["Antalya", 5], ["Kocaeli", 5], ["Konya", 4], ["Adana", 4],
  ["Samsun", 3], ["Kayseri", 3], ["Eskişehir", 3], ["Trabzon", 2], ["Gaziantep", 3], ["Mersin", 2], ["Denizli", 2], ["Sakarya", 2],
];
const TEMSILCI = ["Ahmet Kaya", "Elif Demir", "Mehmet Çelik", "Zeynep Arslan", "Burak Şahin", "Selin Aydın"];
const GRUP = ["Bayi", "Perakende", "Kurumsal", "Toptan", "Zincir Market"];

const URUN_SINIF = [
  { sinif: "TEMEL GIDA", urunler: ["Pirinç", "Bulgur", "Mercimek", "Nohut", "Un", "Şeker", "Tuz", "Makarna", "Fasulye", "Yulaf"], fiyat: [40, 180] },
  { sinif: "YAĞ", urunler: ["Ayçiçek Yağı", "Zeytinyağı", "Mısır Yağı", "Tereyağı", "Margarin"], fiyat: [120, 650] },
  { sinif: "İÇECEK", urunler: ["Maden Suyu", "Meyve Suyu", "Çay", "Türk Kahvesi", "Filtre Kahve", "Ayran", "Gazoz", "Soda"], fiyat: [15, 420] },
  { sinif: "SÜT ÜRÜNLERİ", urunler: ["Beyaz Peynir", "Kaşar Peyniri", "Yoğurt", "Süt", "Labne", "Krema"], fiyat: [35, 520] },
  { sinif: "ATIŞTIRMALIK", urunler: ["Bisküvi", "Çikolata", "Cips", "Kraker", "Kuruyemiş", "Gofret", "Lokum"], fiyat: [12, 380] },
  { sinif: "TEMİZLİK", urunler: ["Deterjan", "Yumuşatıcı", "Bulaşık Deterjanı", "Çamaşır Suyu", "Yüzey Temizleyici", "Sabun"], fiyat: [30, 450] },
  { sinif: "KAĞIT", urunler: ["Tuvalet Kağıdı", "Kağıt Havlu", "Peçete", "Islak Mendil"], fiyat: [25, 320] },
  { sinif: "KONSERVE", urunler: ["Salça", "Ton Balığı", "Turşu", "Reçel", "Bal", "Zeytin"], fiyat: [30, 600] },
  { sinif: "KİŞİSEL BAKIM", urunler: ["Şampuan", "Diş Macunu", "Duş Jeli", "Deodorant", "Tıraş Köpüğü"], fiyat: [35, 300] },
  { sinif: "BAHARAT", urunler: ["Pul Biber", "Kimyon", "Karabiber", "Nane", "Kekik", "Sumak"], fiyat: [20, 250] },
];
const MARKA = ["Anatolia", "Karadeniz", "Ege Sofrası", "Tadım", "Lezzet", "Doğal", "Marmara", "Sofra", "Bereket", "Nefis", "Pınar Vadisi", "Kuzey"];
const BOYUT = ["500 g", "1 kg", "2 kg", "5 kg", "250 g", "1 L", "2 L", "5 L", "12'li", "24'lü"];

const BANKALAR = ["ZİRAAT BANKASI", "İŞ BANKASI", "GARANTİ BBVA", "YAPI KREDİ", "AKBANK", "HALKBANK", "VAKIFBANK", "QNB"];

module.exports = { ON, SOYAD, SEKTOR, EK, ILLER, TEMSILCI, GRUP, URUN_SINIF, MARKA, BOYUT, BANKALAR };
