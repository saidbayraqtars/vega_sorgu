# Kurulum ve İşletim

Sistem iki parçadan oluşur:

| Parça | Nerede | Ne yapar |
|---|---|---|
| **Vega Bulut** (`cloud/` + `web/`) | Sizin VPS'iniz | Veriyi saklar, analiz eder, web panelini sunar. Çok firmalı (her müşteri ayrı veritabanı). |
| **Vega Köprü** (`electron/` + `bridge/`) | Müşterinin SQL Server'ının olduğu Windows makine | Arctos/Vega verisini salt-okunur okur, 15 dakikada bir buluta gönderir. |

Akış: **VPS'i kur → panelde firma aç → köprü anahtarını al → müşteride köprüyü kur → anahtarı gir.**

---

## 1. VPS (Docker ile — önerilen)

### Gereksinimler

- Ubuntu 22.04/24.04 veya Debian 12, en az **2 GB RAM, 2 vCPU, 20 GB disk** (10 firma için rahat; firma başına veri tipik olarak 50–500 MB).
- Bir alan adı (ör. `panel.firmaniz.com`) ve DNS **A kaydı** → VPS'in IP'si.
- Açık portlar: **80** ve **443** (Let's Encrypt sertifikası için 80 de gerekli). Başka port açmayın.

### Adımlar

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh

# Kod
sudo git clone https://github.com/saidbayraqtars/vega_sorgu.git /opt/vega
cd /opt/vega/deploy
sudo cp .env.ornek .env
sudo nano .env        # ALAN_ADI, EPOSTA, PUBLIC_URL, ADMIN_USER, ADMIN_PASSWORD

# Güvenlik duvarı
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# Başlat (ilk derleme birkaç dakika sürer)
sudo docker compose up -d --build
sudo docker compose logs -f vega     # "Vega Bulut dinliyor" görünmeli
```

`https://panel.firmaniz.com` adresine gidin; `.env`'deki `ADMIN_USER` / `ADMIN_PASSWORD` ile girin
(sistem yöneticisi). **İlk girişten sonra şifreyi değiştirin.**

> Caddy sertifikayı otomatik alır ve yeniler. Sertifika alınamıyorsa: DNS kaydı yayıldı mı
> (`dig +short panel.firmaniz.com`), 80/443 açık mı, `docker compose logs caddy`.

### Ortam değişkenleri (`deploy/.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `ALAN_ADI` | — | Panelin alan adı (Caddy sertifikası bunun için alınır) |
| `EPOSTA` | — | Let's Encrypt bildirimleri |
| `PUBLIC_URL` | — | `https://` ile tam adres; çerezler `Secure` olur, köprü ekranında gösterilir |
| `ADMIN_USER` / `ADMIN_PASSWORD` | — | Hiç sistem yöneticisi yoksa ilk açılışta oluşturulur |
| `VARSAYILAN_ENFLASYON` | boş | Yeni firmalara yazılacak yıllık TÜFE (%) — reel büyüme için |
| `TCMB_KURLARI` | `1` | TCMB günlük kurlarını çek (döviz kasa/banka TL karşılığı) |
| `DEMO_IZINLI` | `1` | Yönetim panelinden demo verisi yüklemeye izin. **Canlıda `0` yapın** |
| `KOPRU_MAX_MB` | `64` | Köprü istek gövdesi üst sınırı |
| `LOG_LEVEL` | `info` | `debug · info · warn · error` |

### Firma (müşteri) açma

Panel → **Yönetim → Firmalar → Ekle**: kısa kod (`alfa-gida`), unvan, firma yöneticisi kullanıcı adı/şifresi.
Kayıttan sonra **köprü anahtarı** (`vk_alfa-gida_…`) bir kez gösterilir — kopyalayın; kaybolursa
firma yöneticisi panelinde **Yönetim → Köprü → Yeni anahtar** ile yenisi alınır (eskisi iptal edilebilir).

Komut satırıyla da yapılabilir:

```bash
docker compose exec vega node src/cli.js firma-ekle alfa-gida "Alfa Gıda Ltd" alfa.yonetici 'GucluSifre!'
docker compose exec vega node src/cli.js kopru-anahtari alfa-gida      # yeni anahtar
docker compose exec vega node src/cli.js sifre alfa.yonetici 'YeniSifre!'
```

Her firmada **Ayarlar → Enflasyon (yıllık TÜFE %)** girilmelidir; girilmezse büyüme yalnız nominal
gösterilir ve panelde "enflasyon girilmedi" bilgisi çıkar. Sektör seçimi (toptan, perakende, üretim…)
brüt marj puanlamasının eşiklerini belirler.

### Demo

Gerçek veri gelmeden paneli görmek için: **Yönetim → Firmalar → Ekle → "Demo verisi yükle"**
(`DEMO_IZINLI=1` iken) ya da:

```bash
docker compose exec vega node src/cli.js demo   # demo / demo123 · izleyici / izleyici123
```

### Yedekleme ve geri yükleme

Tüm veritabanlarının tutarlı kopyası `vega-veri` biriminde `/data/yedek/<zaman>/` altına alınır:

```bash
sudo crontab -e
0 3 * * * /opt/vega/deploy/yedekle.sh >> /var/log/vega-yedek.log 2>&1
```

Yedekleri **sunucu dışına** da kopyalayın (disk arızası): `docker compose cp vega:/data/yedek ./yedek`
ardından rclone/scp. Firma verileri köprüden **tam eşitleme** ile yeniden alınabilir; asıl kritik
olan `registry.db`'dir (kullanıcılar, panolar, anahtarlar).

Geri yükleme:

```bash
docker compose stop vega
docker compose cp ./yedek/2026-09-24T03-00-00-000Z/registry.db vega:/data/registry.db
docker compose cp ./yedek/2026-09-24T03-00-00-000Z/tenants/. vega:/data/tenants/
docker compose start vega
```

### Güncelleme

```bash
cd /opt/vega && sudo git pull && cd deploy && sudo docker compose up -d --build
```

Veritabanı şeması açılışta kendiliğinden güncellenir (geriye uyumlu). Kesinti birkaç saniyedir;
köprüler bu sürede hata alırsa bir sonraki turda yeniden dener.

### İzleme

- Sağlık ucu: `GET /api/saglik` → `{"tamam":true}` (Docker sağlık denetimi bunu kullanır).
- Günlükler JSON satırlarıdır: `docker compose logs --since 1h vega`.
- Panel → **Yönetim → Firmalar**: her firmanın köprü durumu (güncel · gecikmeli · kopuk), son eşitleme,
  veri boyutu. Köprü 3 saatten uzun sessiz kalırsa firmanın panelinde kritik uyarı çıkar.

---

## 2. VPS (Docker'sız — systemd)

Node.js ≥ 22.13 gerekir (yerleşik `node:sqlite`; yerel derleme yok).

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo useradd --system --home /var/lib/vega --create-home vega
sudo git clone https://github.com/saidbayraqtars/vega_sorgu.git /opt/vega
cd /opt/vega/cloud && sudo npm ci --omit=dev
# Arayüz (web/ hazırsa)
cd /opt/vega/web && sudo npm ci && sudo npm run build

# Ortam
sudo tee /etc/vega-bulut.env >/dev/null <<'EOF'
PUBLIC_URL=https://panel.firmaniz.com
ADMIN_USER=yonetici
ADMIN_PASSWORD=degistirin
TCMB_KURLARI=1
DEMO_IZINLI=0
EOF
sudo chmod 600 /etc/vega-bulut.env

sudo cp /opt/vega/deploy/vega-bulut.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now vega-bulut
```

HTTPS için Caddy (`sudo apt install caddy`), `/etc/caddy/Caddyfile`:

```
panel.firmaniz.com {
	encode zstd gzip
	request_body /api/kopru/* {
		max_size 80MB
	}
	reverse_proxy 127.0.0.1:8080
}
```

Yedek: `sudo -u vega env DATA_DIR=/var/lib/vega node /opt/vega/cloud/src/cli.js yedek --sakla 7` (cron'a ekleyin).

---

## 3. Müşteri sunucusu — Vega Köprü

Ayrıntılar: [KOPRU.md](KOPRU.md). Kısaca:

1. SQL Server'da salt-okunur kullanıcı açın: [bridge/sql/salt-okunur-kullanici.sql](../bridge/sql/salt-okunur-kullanici.sql).
2. `VegaKopru-Setup-x.y.z.exe` kurulumunu çalıştırın (GitHub Releases). Eski **Vega Sorgu** kuruluysa
   otomatik güncellemeyle Vega Köprü'ye dönüşür ve SQL ayarları korunur.
3. Pencerede SQL bilgilerini, **bulut adresini** ve **köprü anahtarını** girin → **Bağlantıyı test et** → **Kaydet ve başlat**.
4. Sunucuda kimse oturum açmıyorsa **Ayarlar → Çalışma → Sunucu modu → Kur** (yönetici izni ister).

İlk eşitleme veri büyüklüğüne göre 10 sn – birkaç dakika sürer; sonrakiler yalnız değişen parçaları
gönderir (tipik olarak 1 saniyenin altında).

---

## 4. Sürüm yayınlama (köprü uygulaması)

Windows'ta, depo kökünde:

```bat
release.bat            :: patch sürüm (2.0.0 → 2.0.1), GitHub Releases'a yükler
release.bat minor
build.bat              :: yalnız yerel kurulum dosyası (dist\VegaKopru-Setup-x.y.z.exe)
```

Kurulu köprüler güncellemeyi arka planda indirir; gece 03:00–05:00 arasında (eşitleme yokken) ya da
kullanıcı "Güncellemeyi kur" deyince kurulur. Sunucu modundaki köprü güncelleme sırasında
kendiliğinden duraklar ve ardından yeni sürümle devam eder.

> **Önemli:** Yeni köprü sürümünü yayınladığınızda, eski **Vega Sorgu** masaüstü uygulaması kurulu
> tüm bilgisayarlar köprüye dönüşür (raporlar artık web panelindedir). VPS hazır olmadan yayınlamayın.
