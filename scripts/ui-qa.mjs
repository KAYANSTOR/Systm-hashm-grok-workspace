#!/usr/bin/env node
/**
 * فحص بصري سريع لكل شاشات النظام بمقاسَي الحاسوب والجوال.
 *
 * يشغّل متصفح Chromium (Playwright) على خادم التطوير أو أي عنوان يمرَّر له،
 * ثم يحفظ صورة لكل شاشة في `screenshots/qa/` ويطبع حكمًا JSON: حالة HTTP،
 * طول نص الشاشة الرئيسية، التجاوز الأفقي، وأخطاء الطرفية والصفحة.
 *
 * الاستخدام:
 *   node scripts/ui-qa.mjs                 # http://127.0.0.1:8080
 *   node scripts/ui-qa.mjs http://127.0.0.1:8081
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const ROUTES = [
  "/",
  "/sales",
  "/vouchers",
  "/inventory",
  "/cashbox",
  "/expenses",
  "/parties",
  "/reports",
  "/settings",
];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const outDir = join(ROOT, "screenshots", "qa");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));

  for (const route of ROUTES) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    let status = 0;
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60_000 });
      status = res?.status() ?? 0;
    } catch (err) {
      pageErrors.push(`navigation: ${String(err).slice(0, 200)}`);
    }
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      return {
        textLen: text.length,
        textHead: text.slice(0, 90),
        mainLen: main ? main.innerText.replace(/\s+/g, " ").trim().length : -1,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const safe = route === "/" ? "home" : route.slice(1);
    const shot = join(outDir, `${vp.name}-${safe}.png`);
    await page.screenshot({ path: shot });
    results.push({
      vp: vp.name,
      route,
      status,
      ...info,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      shot,
    });
  }
  await context.close();
}

await browser.close();

const failures = results.filter(
  (r) =>
    r.status !== 200 ||
    r.mainLen <= 40 ||
    r.consoleErrors.length > 0 ||
    r.pageErrors.length > 0 ||
    r.overflow > 1,
);

console.log(JSON.stringify({ base: BASE, failures, results }, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
