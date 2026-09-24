import { test, expect, type Page } from "@playwright/test";
import { hataToplayici } from "./yardimci";

async function kutuRaporlari(page: Page) {
  return page.getByTestId("kutu").evaluateAll((l) => l.map((e) => e.getAttribute("data-kutu-rapor")));
}

function kayitBekle(page: Page) {
  // 800 ms gecikmeli kayıt + ağ
  return page.waitForResponse((r) => /\/api\/panolar\/\d+$/.test(r.url()) && r.request().method() === "PUT" && r.ok());
}

test("pano: kutu ekle, sırala, grafik değiştir, sil — yeniden yüklemede kalıcı", async ({ page }) => {
  const hatalar = hataToplayici(page);
  await page.goto("/pano");
  await expect(page.getByTestId("pano-sekme").first()).toBeVisible();

  // Test için yeni pano
  await page.getByTestId("yeni-pano").click();
  await page.getByTestId("yeni-pano-ad").fill("Test panosu");
  await page.getByTestId("yeni-pano-kaydet").click();
  await expect(page.getByRole("tab", { name: "Test panosu" })).toHaveAttribute("aria-selected", "true");
  const panoUrl = page.url();

  // Kutu ekle (katalog çekmecesi)
  await page.getByTestId("kutu-ekle").click();
  const cekmece = page.getByTestId("katalog-cekmece");
  for (const [ara, id] of [["müşteri sıralaması", "satis.top.cari"], ["tahsilat", "tahsilat.kpi"]] as const) {
    await cekmece.getByTestId("katalog-ara").fill(ara);
    await cekmece.locator(`[data-rapor="${id}"]`).click();
    await expect(cekmece.getByTestId("onizleme")).toBeVisible();
    const kayit = kayitBekle(page);
    await cekmece.getByTestId("katalog-ekle").click();
    await kayit;
  }
  await page.keyboard.press("Escape");
  expect(await kutuRaporlari(page)).toEqual(["satis.top.cari", "tahsilat.kpi"]);

  await page.reload();
  await expect(page.getByTestId("kutu")).toHaveCount(2);
  expect(await kutuRaporlari(page)).toEqual(["satis.top.cari", "tahsilat.kpi"]);

  // Sırala (klavye ile sürükle-bırak)
  await page.getByTestId("duzenle").click();
  await page.getByTestId("kutu-tasi").first().focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  let kayit = kayitBekle(page);
  await page.keyboard.press("Space");
  await kayit;
  expect(await kutuRaporlari(page)).toEqual(["tahsilat.kpi", "satis.top.cari"]);

  // Grafik türü: müşteri sıralaması → halka (pasta)
  await page.locator('[data-kutu-rapor="satis.top.cari"]').getByTestId("kutu-menu").click();
  kayit = kayitBekle(page);
  await page.getByTestId("kutu-ayar").locator('[data-grafik-sec="pasta"]').click();
  await kayit;
  await page.getByTestId("kutu-tamam").click();

  await page.reload();
  await expect(page.getByTestId("kutu")).toHaveCount(2);
  expect(await kutuRaporlari(page)).toEqual(["tahsilat.kpi", "satis.top.cari"]);
  const r = await page.request.get("/api/panolar");
  const pano = (await r.json()).panolar.find((p: { ad: string }) => p.ad === "Test panosu");
  expect(pano.widgets.find((w: { rapor: string }) => w.rapor === "satis.top.cari").grafik).toBe("pasta");

  // Sil
  await page.getByTestId("duzenle").click();
  await page.locator('[data-kutu-rapor="tahsilat.kpi"]').getByTestId("kutu-menu").click();
  kayit = kayitBekle(page);
  await page.getByTestId("kutu-sil").click();
  await kayit;
  await page.goto(panoUrl);
  await expect(page.getByTestId("kutu")).toHaveCount(1);
  expect(await kutuRaporlari(page)).toEqual(["satis.top.cari"]);

  // Temizlik
  await page.request.delete(`/api/panolar/${pano.id}`, { headers: { origin: new URL(page.url()).origin } });
  expect(hatalar).toEqual([]);
});
