#!/usr/bin/env node
/*
 * Vega Sorgu — GitHub Release yayınlayıcı
 * Kullanım: node scripts/release.js [patch|minor|major|none]
 *   - Sürümü server/package.json'dan okur, bump eder (varsayılan patch)
 *   - build.bat ile client+exe derler (VegaSorgu.exe)
 *   - commit + tag + push, ardından GitHub Release oluşturup exe'yi yükler
 * Token: git credential (Windows Credential Manager) üzerinden alınır — gh CLI gerekmez.
 */
const { execFileSync, spawnSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "server", "package.json");
const EXE = path.join(ROOT, "VegaSorgu.exe");
const REPO_OWNER = "saidbayraqtars";
const REPO_NAME = "vega_sorgu";

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: "pipe", encoding: "utf8", ...opts }).trim();
}

function bumpVersion(v, kind) {
  if (kind === "none") return v;
  const [a, b, c] = v.split(".").map(Number);
  if (kind === "major") return `${a + 1}.0.0`;
  if (kind === "minor") return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`; // patch
}

// Token'ı pipe bozmadan al (PowerShell pipe "missing protocol field" verir → spawnSync input)
function getToken() {
  const r = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("password="));
  if (!line) throw new Error("GitHub token bulunamadı (git credential fill boş döndü).");
  return line.slice("password=".length).trim();
}

function api(token, method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        host: "api.github.com",
        path: urlPath,
        method,
        headers: {
          "User-Agent": "vega-sorgu-release",
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (d) => (buf += d));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(buf || "{}"));
          else reject(new Error(`GitHub API ${method} ${urlPath} → ${res.statusCode}: ${buf}`));
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(token, uploadUrl, filePath) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const name = path.basename(filePath);
    const base = uploadUrl.replace(/\{.*\}$/, "");
    const u = new URL(`${base}?name=${encodeURIComponent(name)}`);
    const req = https.request(
      {
        host: u.host,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "User-Agent": "vega-sorgu-release",
          Authorization: `token ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (d) => (buf += d));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(buf || "{}"));
          else reject(new Error(`Asset yükleme hatası ${res.statusCode}: ${buf}`));
        });
      }
    );
    req.on("error", reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

(async () => {
  const kind = (process.argv[2] || "patch").toLowerCase();
  const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));
  const newVersion = bumpVersion(pkg.version, kind);
  const tag = `v${newVersion}`;
  console.log(`Sürüm: ${pkg.version} → ${newVersion} (${kind})`);

  if (kind !== "none" && newVersion !== pkg.version) {
    pkg.version = newVersion;
    fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n");
  }

  console.log("Derleniyor (build.bat)...");
  execFileSync("cmd", ["/c", path.join(ROOT, "build.bat")], { cwd: ROOT, stdio: "inherit" });
  if (!fs.existsSync(EXE)) throw new Error("VegaSorgu.exe üretilmedi — build başarısız.");

  console.log("Commit + tag + push...");
  sh("git", ["add", "-A"]);
  try { sh("git", ["commit", "-m", `release ${tag}`]); } catch { console.log("(commit edilecek değişiklik yok)"); }
  sh("git", ["tag", "-f", tag]);
  sh("git", ["push", "origin", "HEAD"]);
  sh("git", ["push", "-f", "origin", tag]);

  console.log("GitHub Release oluşturuluyor...");
  const token = getToken();
  const rel = await api(token, "POST", `/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
    tag_name: tag,
    name: tag,
    body: `Vega Sorgu ${tag}`,
    draft: false,
    prerelease: false,
  });
  console.log(`Release: ${rel.html_url}`);

  console.log("VegaSorgu.exe yükleniyor...");
  await uploadAsset(token, rel.upload_url, EXE);
  console.log(`✅ Yayınlandı: ${tag} → ${rel.html_url}`);
})().catch((e) => {
  console.error("RELEASE HATASI:", e.message);
  process.exit(1);
});
