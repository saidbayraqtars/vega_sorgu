#!/usr/bin/env node
/*
 * Vega Köprü — Windows tepsi uygulaması (Electron) sürüm yayınlayıcı
 * GH_TOKEN'ı git credential'dan alır, sürümü artırır, electron-builder ile kurulumu
 * GitHub Releases'a yükler. Kurulu uygulamalar (eski "Vega Sorgu" masaüstü sürümleri dahil)
 * electron-updater ile kendiliğinden güncellenir.
 *
 * Kullanım: node scripts/release.js [patch|minor|major|none]   (varsayılan: patch)
 * Not: Web paneli (cloud/ + web/) bu paketin parçası değildir; VPS'e ayrıca kurulur (docs/KURULUM.md).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) { console.error(`\nKomut başarısız: ${cmd} ${args.join(" ")}`); process.exit(r.status || 1); }
  return r;
};

// 1) GitHub token (credential manager)
const fill = spawnSync("git", ["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8" });
const m = (fill.stdout || "").match(/^password=(.+)$/m);
if (!m) { console.error('HATA: GitHub token alınamadı. Bir kez "git push" yapıp girişi tamamlayın.'); process.exit(1); }

// 2) Sürüm artır
const bump = (process.argv[2] || "patch").toLowerCase();
if (["patch", "minor", "major"].includes(bump)) run("npm", ["version", bump, "--no-git-tag-version"]);
else if (bump !== "none") { console.error(`Geçersiz argüman: ${bump} (patch|minor|major|none)`); process.exit(1); }
const version = require(path.join(root, "package.json")).version;
console.log(`\n▶ Yayınlanıyor: Vega Köprü v${version} → github.com/saidbayraqtars/vega_sorgu\n`);

// 3) Bağımlılıklar + köprü birim testleri (MSSQL gerektirmeyen)
run("npm", ["install"]);
run("node", ["--test", "bridge/test/lock.test.js"]);

// 4) Kurulum derle + GitHub Releases'a yükle
console.log("Kurulum derleniyor + yükleniyor...");
run("npx", ["electron-builder", "--win", "--publish", "always"], { env: { ...process.env, GH_TOKEN: m[1] } });

// 5) Sürüm dosyalarını commit + push (best-effort; yalnız sürüm dosyaları)
spawnSync("git", ["add", "package.json", "package-lock.json"], { cwd: root, stdio: "inherit" });
spawnSync("git", ["commit", "-m", `release v${version}`], { cwd: root, stdio: "inherit" });
spawnSync("git", ["push", "origin", "HEAD"], { cwd: root, stdio: "inherit" });
console.log(`\n✅ v${version} yayınlandı. Kurulu uygulamalar otomatik güncellenecek.`);
