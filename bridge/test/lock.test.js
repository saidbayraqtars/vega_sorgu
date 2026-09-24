// Tek etkin eşitleyici: kilit, izleyici modu, istek dosyası, bayat kilidin devralınması.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Lock } = require("../src/lock");
const { Config } = require("../src/config");
const { SyncEngine } = require("../src/sync");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "kopru-kilit-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = { info() {}, warn() {}, error() {} };

test("kilit: tek sahip, bırakınca devralınır, bayat kilit silinir", () => {
  const dir = tmp();
  const a = new Lock(dir, "servis");
  const b = new Lock(dir, "tepsi");
  assert.equal(a.tryAcquire(), true);
  assert.equal(b.tryAcquire(), false);
  assert.equal(b.holder().sahip, "servis");
  a.release();
  assert.equal(b.holder(), null);
  assert.equal(b.tryAcquire(), true);
  // Tazelenmeyen (çökmüş sürecin) kilidi bayattır
  const old = (Date.now() - 10 * 60000) / 1000;
  fs.utimesSync(b.file, old, old);
  const c = new Lock(dir, "tepsi");
  assert.equal(c.tryAcquire(), true);
  // Eski sahip kilidin başkasına geçtiğini fark eder
  let lost = false;
  b.onLost = () => { lost = true; };
  b.beat();
  assert.equal(lost, true);
  assert.equal(b.held, false);
  c.release();
  assert.equal(fs.existsSync(c.file), false);
});

test("motor: ikinci süreç izleyici olur, isteği dosyayla iletir, canlı durum paylaşılır", async () => {
  const dir = tmp();
  const cfgA = new Config(dir);
  const cfgB = new Config(dir);
  const runs = [];
  const mk = (cfg, sahip) => {
    const e = new SyncEngine(cfg, { log: quiet, sahip, yoklamaMs: { yerel: 50, kilit: 80, ping: 3600000 } });
    e.runOnce = async ({ full, reason }) => { runs.push({ sahip, full, reason }); e.setStatus({ durum: "tamam", son: new Date().toISOString(), ilerleme: null }); return {}; };
    return e;
  };
  const a = mk(cfgA, "servis");
  const b = mk(cfgB, "tepsi");
  a.start();
  await wait(20);
  b.start();
  assert.equal(a.mode, "etkin");
  assert.equal(b.mode, "izleyici");
  assert.deepEqual(runs.map((r) => r.sahip), ["servis"]);
  assert.equal(cfgB.state().canli.sahip, "servis");
  assert.ok(cfgB.state().canli.sonraki);

  // İzleyicideki "Şimdi eşitle" → etkin süreç çalıştırır
  assert.equal(b.syncNow(true), "istendi");
  await wait(200);
  assert.deepEqual(runs.at(-1), { sahip: "servis", full: true, reason: "elle" });
  assert.equal(fs.existsSync(cfgA.requestFile), false);

  // Etkin süreç durunca izleyici devralır
  a.stop();
  await wait(250);
  assert.equal(b.mode, "etkin");
  assert.equal(runs.at(-1).sahip, "tepsi");
  b.stop();
});

test("ayarlar başka süreçte değişince yeniden okunur", async () => {
  const dir = tmp();
  const a = new Config(dir);
  a.update({ bulut: { url: "https://bir.ornek" } });
  const b = new Config(dir);
  assert.equal(b.reloadIfChanged(), false);
  await wait(20);
  a.update({ bulut: { url: "https://iki.ornek/" } });
  const t = (Date.now() + 5000) / 1000;
  fs.utimesSync(a.file, t, t); // aynı milisaniyede yazım olasılığına karşı
  assert.equal(b.reloadIfChanged(), true);
  assert.equal(b.data.bulut.url, "https://iki.ornek");
});
