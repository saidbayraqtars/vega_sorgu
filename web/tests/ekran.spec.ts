import { test, expect, type Page } from "@playwright/test";

// 390×844 (telefon) ve 1440×900 ekran görüntüleri → web/screenshots/
const boyutlar = [
  { ad: "telefon", w: 390, h: 844 },
  { ad: "masaustu", w: 1440, h: 900 },
];
const sayfalar = [
  { ad: "durum", yol: "/", bekle: "bolum-projeksiyon" },
  { ad: "pano", yol: "/pano", bekle: "pano-izgara" },
  { ad: "rapor", yol: "/rapor/satis.top.cari?donem=bu_yil", bekle: "rapor-govde" },
  { ad: "ayarlar", yol: "/ayarlar", bekle: "genel-ayarlar" },
];

async function hazirla(page: Page, yol: string, bekle: string) {
  await page.goto(yol);
  await expect(page.getByTestId(bekle)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900); // grafik animasyonu
}

for (const b of boyutlar) {
  for (const s of sayfalar) {
    test(`ekran: ${s.ad} ${b.ad}`, async ({ page }) => {
      await page.setViewportSize({ width: b.w, height: b.h });
      await hazirla(page, s.yol, s.bekle);
      // Sayfa yatay kaymamalı
      const tasma = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(tasma).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `screenshots/${s.ad}-${b.ad}.png` });
    });
  }
}

for (const b of boyutlar) {
  test(`ekran: koyu tema ${b.ad}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("vb_tercih", JSON.stringify({ tema: "sistem" })));
    await page.setViewportSize({ width: b.w, height: b.h });
    await hazirla(page, "/", "bolum-projeksiyon");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: `screenshots/durum-koyu-${b.ad}.png` });
    await hazirla(page, "/pano", "pano-izgara");
    await page.screenshot({ path: `screenshots/pano-koyu-${b.ad}.png` });
  });
}
