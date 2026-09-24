# Vega Bulut (VPS sunucusu)

Köprü ajanından gelen Arctos/Vega verisini alır, analiz eder (sağlık skoru, büyüme endeksi,
anlık finansal durum, nakit projeksiyonu, uyarılar, ~1.000 rapor) ve arayüze JSON API olarak sunar.

```bash
cd cloud
npm install
npm run demo        # "demo" firması + örnek veri; giriş: demo / demo123 · admin / admin123
npm start           # http://localhost:8080  (PORT, DATA_DIR ortam değişkenleri)
npm test
```

- API sözleşmesi: [../docs/API.md](../docs/API.md)
- Gereksinim: Node.js ≥ 22.13 (yerleşik `node:sqlite`; yerel derleme gerekmez)
