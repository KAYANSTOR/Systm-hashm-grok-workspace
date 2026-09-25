/**
 * فحص شاشة الإعدادات (تبويباتها + تخطيط الجوال)
 * ---------------------------------------------
 * يشغّل متصفحًا حقيقيًا ويفتح /settings على مقاس حاسوب ومقاس هاتف، ثم:
 *   1) يضغط كل قسم ويتأكد أن محتواه ظهر فعلًا (لا قشرة فارغة).
 *   2) يقيس التجاوز الأفقي (scrollWidth > innerWidth) على كل مقاس.
 *   3) يرصد أخطاء الـ console وأخطاء الصفحة غير الملتقطة.
 *   4) يحفظ لقطة لكل قسم على الجوال في screenshots/settings/.
 *
 * التشغيل: node scripts/settings-qa.mjs   (يحتاج خادم التطوير على 8080)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SETTINGS_QA_BASE || "http://127.0.0.1:8080";
const OUT_DIR = "screenshots/settings";

/**
 * `label` = تسمية قائمة الحاسوب الجانبية، و`short` = تسمية شبكة الجوال.
 * الفحص يجرب الاثنتين حتى يعمل على المقاسين.
 */
const TABS = [
  { label: "نظرة عامة", short: "نظرة عامة", expect: ["حالة النظام", "مختصرات"] },
  { label: "بيانات المعمل", short: "بيانات المعمل", expect: ["بيانات المعمل", "حفظ التعديلات"] },
  { label: "الحساب والوصول", short: "الحساب", expect: ["الحساب"] },
  { label: "التخزين والمزامنة", short: "المزامنة", expect: ["مزامنة الآن"] },
  { label: "المخازن والفئات", short: "المخازن والفئات", expect: ["المخازن", "فئات المنتجات"] },
  { label: "النسخ الاحتياطي", short: "النسخ الاحتياطي", expect: ["تنزيل نسخة احتياطية"] },
  { label: "منطقة الخطر", short: "منطقة الخطر", expect: ["منطقة الخطر", "بدء حذف وتصفية قاعدة البيانات"] },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, shots: false },
  { name: "mobile", width: 390, height: 844, shots: true },
  { name: "mobile-320", width: 320, height: 720, shots: false },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const report = { base: BASE, viewports: [], problems: [] };

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    locale: "ar-YE",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 300)));

  const response = await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 45000 });
  const entry = {
    name: viewport.name,
    status: response?.status() ?? 0,
    tabs: [],
    consoleErrors,
    pageErrors,
  };

  if (entry.status !== 200) report.problems.push(`${viewport.name}: /settings أعاد ${entry.status}`);

  // انتظر انتهاء الترطيب وظهور محتوى القسم الافتراضي (قبلها يظهر هيكل تحميل).
  await page
    .waitForFunction(
      () => (document.querySelector('[role="tabpanel"]')?.innerText || "").trim().length > 20,
      { timeout: 15000 },
    )
    .catch(() => report.problems.push(`${viewport.name}: لم يظهر محتوى أي قسم خلال 15 ثانية`));

  // كل الأقسام يجب أن تكون ظاهرة بلا تمرير أفقي (خلل «الإعدادات ناقصة على الهاتف»).
  const navLayout = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="أقسام الإعدادات"]');
    const buttons = Array.from(nav.querySelectorAll('button')).filter((b) => b.offsetParent);
    const offscreen = buttons.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.right > window.innerWidth + 1 || r.left < -1;
    });
    return { total: buttons.length, offscreen: offscreen.map((b) => b.innerText.trim()) };
  });
  entry.nav = navLayout;
  if (navLayout.offscreen.length) {
    report.problems.push(
      `${viewport.name}: أقسام خارج الشاشة (${navLayout.offscreen.length}/${navLayout.total}) → ${navLayout.offscreen.join(" · ")}`,
    );
  }

  for (const tab of TABS) {
    let clicked = false;
    let missing = [];
    try {
      const locatorFor = (text) =>
        page.locator('nav[aria-label="أقسام الإعدادات"] button:visible', { hasText: text }).first();
      const button = (await locatorFor(tab.label).count()) ? locatorFor(tab.label) : locatorFor(tab.short);
      await button.click({ timeout: 8000 });
      clicked = true;
      await page.waitForTimeout(320);
      // نفحص نص القسم المعروض نفسه، لا أي عنصر في الصفحة (القائمة الجانبية
      // تحمل نفس أسماء الأقسام فكان الفحص السابق يعطي نتائج مضللة).
      const panelText = await page.evaluate(
        () => document.querySelector('[role="tabpanel"]')?.innerText || "",
      );
      for (const text of tab.expect) {
        if (!panelText.includes(text)) missing.push(text);
      }
    } catch (error) {
      missing.push(`click-failed: ${String(error).slice(0, 120)}`);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    if (viewport.shots) {
      await page.screenshot({
        path: `${OUT_DIR}/${viewport.name}-${TABS.indexOf(tab) + 1}.png`,
        fullPage: false,
      });
    }

    entry.tabs.push({ label: tab.label, clicked, missing, overflow });
    if (!clicked || missing.length) {
      report.problems.push(`${viewport.name} · ${tab.label}: ${missing.join(" | ") || "لم يُضغط"}`);
    }
    if (overflow > 1) {
      report.problems.push(`${viewport.name} · ${tab.label}: تجاوز أفقي ${overflow}px`);
    }
  }

  entry.consoleErrors = consoleErrors;
  entry.pageErrors = pageErrors;
  if (consoleErrors.length) report.problems.push(`${viewport.name}: أخطاء console (${consoleErrors.length})`);
  if (pageErrors.length) report.problems.push(`${viewport.name}: أخطاء صفحة (${pageErrors.length})`);

  report.viewports.push(entry);
  await context.close();
}

await browser.close();

report.ok = report.problems.length === 0;
writeFileSync(`${OUT_DIR}/qa.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
