import { test, expect } from "@playwright/test";
import { hataToplayici, spaGit } from "./yardimci";

// /api/raporlar'daki TÜM rapor kimliklerini görüntüleyicide açar (gruplar paralel çalışır)
const GRUP = 8;

test.describe.configure({ mode: "parallel" });

for (let g = 0; g < GRUP; g++) {
  test(`tüm raporlar — grup ${g + 1}/${GRUP}`, async ({ page }) => {
    test.setTimeout(20 * 60_000);
    const r = await page.request.get("/api/raporlar");
    const idler: string[] = (await r.json()).raporlar.map((x: { id: string }) => x.id).filter((_: string, i: number) => i % GRUP === g);
    const hatalar = hataToplayici(page);
    const sorunlu: string[] = [];
    await page.goto("/raporlar");
    await expect(page.getByTestId("raporlar-sayfasi")).toBeVisible();
    for (const id of idler) {
      const once = hatalar.length;
      await spaGit(page, `/rapor/${encodeURIComponent(id)}`);
      const govde = page.getByTestId("rapor-govde");
      try {
        await expect(govde.locator("[data-sonuc], [role=alert]").first()).toBeVisible({ timeout: 20_000 });
        if (await govde.locator("[role=alert]").count()) throw new Error(await govde.locator("[role=alert]").first().innerText());
        // Grafik (canvas), tablo, boş durum veya sayı görünür olmalı
        const cizim = govde.locator("[data-grafik] canvas, [data-tablo], [data-bos], [data-sonuc=kpi], [data-sonuc=saglik], [data-sonuc=buyume]").first();
        await expect(cizim).toBeVisible({ timeout: 20_000 });
      } catch (e) {
        sorunlu.push(`${id}: ${(e as Error).message.split("\n")[0]}`);
      }
      if (hatalar.length > once) sorunlu.push(`${id}: ${hatalar.slice(once).join(" | ")}`);
    }
    expect(sorunlu, sorunlu.join("\n")).toEqual([]);
  });
}
