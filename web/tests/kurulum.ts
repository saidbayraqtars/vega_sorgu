import { test as setup, expect } from "@playwright/test";

// Demo kullanıcısıyla oturum aç, çerezi sakla; panoları varsayılana döndür (testler tekrar çalıştırılabilir olsun)
setup("oturum", async ({ request }) => {
  const r = await request.post("/api/auth/giris", { data: { kullanici: "demo", sifre: "demo123" } });
  expect(r.ok()).toBeTruthy();
  await request.put("/api/auth/tercihler", { data: { tema: "sistem", donem: "bu_ay", firmalar: [] } });
  await request.post("/api/panolar/sifirla", { data: {} });
  await request.storageState({ path: "test-results/.oturum.json" });
});
