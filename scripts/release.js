#!/usr/bin/env node
/*
 * Vega Sorgu — masaüstü (Electron) sürüm yayınlayıcı
 * GH_TOKEN'ı git credential'dan alır, sürümü bump eder, frontend'i derleyip
 * server/public'e kopyalar, electron-builder ile installer'ı GitHub Releases'a
 * yükler. Kurulu uygulamalar electron-updater ile kendiliğinden günceller.
 *
 * Kullanım: node scripts/release.js [patch|minor|major|none]   (varsayılan: patch)
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

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

// 2) Sürüm bump
const bump = (process.argv[2] || "patch").toLowerCase();
if (["patch", "minor", "major"].includes(bump)) run("npm", ["version", bump, "--no-git-tag-version"]);
else if (bump !== "none") { console.error(`Geçersiz argüman: ${bump} (patch|minor|major|none)`); process.exit(1); }
const version = require(path.join(root, "package.json")).version;
console.log(`\n▶ Yayınlanıyor: v${version} → github.com/saidbayraqtars/vega_sorgu\n`);

// 3) Frontend derle + server/public'e kopyala
console.log("Frontend derleniyor...");
run("npm", ["install"], { cwd: path.join(root, "client") });
run("npm", ["run", "build"], { cwd: path.join(root, "client") });
const pub = path.join(root, "server", "public");
fs.rmSync(pub, { recursive: true, force: true });
fs.cpSync(path.join(root, "client", "dist"), pub, { recursive: true });
console.log("Statik dosyalar server/public'e kopyalandı.");

// 4) Installer derle + GitHub Releases'a yükle
console.log("Installer derleniyor + yükleniyor...");
run("npx", ["electron-builder", "--win", "--publish", "always"], { env: { ...process.env, GH_TOKEN: m[1] } });

// 5) Kaynak commit + push (best-effort)
spawnSync("git", ["add", "-A"], { cwd: root, stdio: "inherit" });
spawnSync("git", ["commit", "-m", `release v${version}`], { cwd: root, stdio: "inherit" });
spawnSync("git", ["push", "origin", "HEAD"], { cwd: root, stdio: "inherit" });
console.log(`\n✅ v${version} yayınlandı. Kurulu uygulamalar otomatik güncellenecek.`);
