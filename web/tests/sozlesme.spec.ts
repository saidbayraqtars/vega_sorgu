import { test, expect } from "@playwright/test";

// Sunucu sözleşmesinin arayüze doğru yansıdığı yerler (docs/API.md)

test("sağlık ölçütleri: % yüzde sayısı, puan yüzde puanı olarak gösterilir", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sağlık skorunun ayrıntısı" }).click();
  const dlg = page.getByRole("dialog", { name: "Finansal sağlık" });
  // Sütun ayrıntısındaki ölçüt satırı (üstteki "Neden?" listeleri değil)
  const deger = (ad: string) => dlg.locator("li:has(.rakam.font-bold)", { hasText: ad }).first().locator(".rakam.font-bold");
  // Demo verisi: marj ≈ %30, ivme ≈ −9,3 puan. Kesir/yüzde karışırsa %0,3 ya da %2.996 görünür.
  await expect(deger("Brüt kâr marjı")).toHaveText(/^%[1-9]\d(,\d)?$/);
  await expect(deger("Tahsilat oranı")).toHaveText(/^%\d{2,3}(,\d)?$/);
  await expect(deger("İvme")).toHaveText(/^[+−]?[1-9]\d?(,\d)? puan$/);
});

test("ilk N: seçenekler ve varsayılan rapordan gelir; kısaltılmış tablo sayıyı söyler", async ({ page }) => {
  await page.goto("/rapor/ozel.borclu_musteriler");
  const grup = page.getByRole("group", { name: "İlk N" });
  await expect(grup.getByRole("button")).toHaveText(["25", "50", "100", "250", "500"]);
  await expect(grup.getByRole("button", { name: "100", exact: true })).toHaveAttribute("aria-pressed", "true");
  await grup.getByRole("button", { name: "25", exact: true }).click();
  await expect(page.getByTestId("tablo-kisaltildi")).toContainText("25 /");
  // Dönem kullanmayan raporda dönem seçicisi yok
  await expect(page.getByTestId("rapor-donem")).toHaveCount(0);
  // Sıralama raporu: 5/10/20/50, varsayılan 10
  await page.goto("/rapor/satis.top.cari");
  await expect(page.getByRole("group", { name: "İlk N" }).getByRole("button", { name: "10", exact: true })).toHaveAttribute("aria-pressed", "true");
});
