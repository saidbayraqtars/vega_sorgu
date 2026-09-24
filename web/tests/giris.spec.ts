import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("hatalı şifre mesajı", async ({ page }) => {
  await page.goto("/");
  await page.fill("input[name=kullanici]", "demo");
  await page.fill("input[name=sifre]", "yanlis-sifre");
  await page.getByRole("button", { name: "Giriş", exact: true }).click();
  await expect(page.getByTestId("giris-hata")).toHaveText("Kullanıcı adı veya şifre hatalı");
});

test("giriş ve çıkış", async ({ page }) => {
  await page.goto("/");
  await page.fill("input[name=kullanici]", "demo");
  await page.fill("input[name=sifre]", "demo123");
  await page.getByRole("button", { name: "Giriş", exact: true }).click();
  await expect(page.getByTestId("durum-sayfasi")).toBeVisible();
  await expect(page.getByTestId("kiraci-ad")).toHaveText("Demo Ticaret A.Ş.");
  await page.getByTestId("kullanici-menu").click();
  await page.getByTestId("cikis").click();
  await expect(page.locator("input[name=kullanici]")).toBeVisible();
  await page.reload();
  await expect(page.locator("input[name=kullanici]")).toBeVisible();
});
