import type { Page } from "@playwright/test";

/** Konsol hatalarını ve yakalanmamış istisnaları toplar. */
export function hataToplayici(page: Page) {
  const hatalar: string[] = [];
  page.on("pageerror", (e) => hatalar.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Oturum yokken /auth/ben 401 dönmesi beklenen davranış
    if (/status of 401/.test(t)) return;
    hatalar.push(`console: ${t}`);
  });
  return hatalar;
}

/** SPA içinde tam sayfa yüklemeden yönlendir. */
export async function spaGit(page: Page, yol: string) {
  await page.evaluate((y) => {
    window.history.pushState(null, "", y);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, yol);
}
