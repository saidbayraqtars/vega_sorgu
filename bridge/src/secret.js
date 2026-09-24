// Ayar dosyasındaki parolaları düz metin bırakmamak için obfüskasyon (Kılavuz §43.7).
// Gerçek güvenlik değildir (anahtar programın içinde); eski Vega Sorgu (v1.1.x) config.json
// dosyalarıyla uyumludur: v3 sabit anahtar, v2 (hostname'e bağlı) yalnız okumada.

const crypto = require("crypto");
const os = require("os");

const APP_SECRET = "vega-sorgu-static-key-v3-stable-2026";
const APP_SECRET_LEGACY = "vega-sorgu-static-key-v2::" + (os.hostname() || "local");
const keyOf = (s) => crypto.createHash("sha256").update(s).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv("aes-256-cbc", keyOf(APP_SECRET), iv);
  return iv.toString("hex") + ":" + c.update(String(text), "utf8", "hex") + c.final("hex");
}

function decryptWith(secret, text) {
  const parts = String(text).split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const d = crypto.createDecipheriv("aes-256-cbc", keyOf(secret), iv);
  return d.update(Buffer.from(parts.join(":"), "hex"), undefined, "utf8") + d.final("utf8");
}

function decrypt(text) {
  if (!text) return "";
  try { return decryptWith(APP_SECRET, text); } catch { return decryptWith(APP_SECRET_LEGACY, text); }
}

module.exports = { encrypt, decrypt };
