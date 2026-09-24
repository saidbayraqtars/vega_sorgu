import { test, expect } from "@playwright/test";

test("katalogda müşteri araması sonuç verir (Türkçe duyarsız)", async ({ page }) => {
  await page.goto("/raporlar");
  await expect(page.getByTestId("kategori").first()).toBeVisible();
  await page.getByTestId("katalog-ara").fill("müşteri");
  await expect(page.getByTestId("rapor-karti").first()).toBeVisible();
  const metin = await page.getByText(/\d+ rapor$/).first().innerText();
  expect(Number(metin.replace(/\D/g, ""))).toBeGreaterThan(5);
  // Büyük harf / aksansız yazım da aynı sonucu vermeli
  await page.getByTestId("katalog-ara").fill("MUSTERI");
  await expect(page.getByText(metin, { exact: true })).toBeVisible();
  await page.getByTestId("rapor-karti").first().click();
  await expect(page.getByTestId("rapor-goruntuleyici")).toBeVisible();
});
