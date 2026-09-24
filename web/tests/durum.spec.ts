import { test, expect } from "@playwright/test";
import { hataToplayici } from "./yardimci";

test("Durum sayfasındaki tüm bölümler görünür", async ({ page }) => {
  const hatalar = hataToplayici(page);
  await page.goto("/");
  for (const id of ["bolum-saglik", "bolum-buyume", "bolum-finans", "bolum-buay", "bolum-projeksiyon", "bolum-uyarilar", "bolum-oranlar"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("buyume-yuzde")).toContainText("%");
  for (const k of ["kutu-kasa", "kutu-banka", "kutu-alacak", "kutu-borc", "kutu-cek-alinan", "kutu-cek-verilen", "kutu-nis"]) {
    await expect(page.getByTestId(k)).toContainText("₺");
  }
  await expect(page.getByTestId("oran-cip")).toHaveCount(4);
  await expect(page.getByTestId("bolum-projeksiyon").locator("[data-grafik] canvas")).toBeVisible();
  // Sağlık ayrıntısı
  await page.getByRole("button", { name: "Sağlık skorunun ayrıntısı" }).click();
  await expect(page.getByRole("dialog", { name: "Finansal sağlık" })).toContainText("Neden?");
  await page.keyboard.press("Escape");
  expect(hatalar).toEqual([]);
});

test("uyarılar sayfası gruplu", async ({ page }) => {
  await page.goto("/uyarilar");
  await expect(page.getByTestId("uyari").first()).toBeVisible();
});
