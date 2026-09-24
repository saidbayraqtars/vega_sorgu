import { test, expect } from "@playwright/test";
import { hataToplayici } from "./yardimci";

// Yalnız görüntüleme yetkili kullanıcı (rol: user). Sunucudaki yönetici ara katmanı bir ara tüm /api
// isteklerini 403'e düşürmüştü; bu test o hatanın geri gelmesini yakalar.
test.use({ storageState: { cookies: [], origins: [] } });

test("izleyici: durum, uyarı rozeti, uyarılar, rapor ve panolar açılır", async ({ page }) => {
  const hatalar = hataToplayici(page);
  await page.goto("/");
  await page.fill("input[name=kullanici]", "izleyici");
  await page.fill("input[name=sifre]", "izleyici123");
  await page.getByRole("button", { name: "Giriş", exact: true }).click();
  await expect(page.getByTestId("durum-sayfasi")).toBeVisible();
  for (const id of ["bolum-saglik", "bolum-buyume", "bolum-finans", "bolum-uyarilar"]) await expect(page.getByTestId(id)).toBeVisible();
  // Uyarı rozeti (/api/surum → uyariOzet) sol rayda
  await expect(page.getByTestId("uyari-rozeti").first()).toHaveText(/^\d+\+?$/);
  await page.goto("/uyarilar");
  await expect(page.getByTestId("uyari").first()).toBeVisible();
  await page.goto("/rapor/net_ciro.trend.ay");
  await expect(page.getByTestId("rapor-govde").locator("[data-grafik] canvas")).toBeVisible();
  await page.goto("/pano");
  await expect(page.getByRole("heading").first()).toBeVisible();
  expect(hatalar).toEqual([]);
});
