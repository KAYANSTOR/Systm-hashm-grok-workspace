/**
 * فحص الشاشة الرئيسية بعد إعادة تصميمها
 * -------------------------------------
 * يشغّل متصفحًا حقيقيًا ويتحقق من طلب صاحب المعمل:
 *   1) الاسم الجديد «النظام الرئيسي» في ترويسة الشاشة وفي القائمة الجانبية.
 *   2) اختفاء رسالة الترحيب من أعلى الشاشة.
 *   3) اختفاء الكروت الثلاثة (مستحقات الموردين / مواد تحتاج توريد / حركة الشهر).
 *   4) كرت «حركة اليوم» بعرض الشاشة كاملًا فوق «آخر العمليات».
 *   5) النقر عليه يعرض كل حركات اليوم (يُنشأ سند حقيقي من الشاشة أولًا).
 *
 * التشغيل: node scripts/home-qa.mjs   (يحتاج خادم التطوير على 8080)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.HOME_QA_BASE || "http://127.0.0.1:8080";
const OUT_DIR = "screenshots/home";
const MOVEMENT_DESC = "فحص الشاشة الرئيسية — حركة اليوم";

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const report = { base: BASE, viewports: [], problems: [] };

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

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

  const entry = { name: viewport.name, ...viewport, consoleErrors, pageErrors };

  // ————— 1) سند قبض حقيقي حتى يحتوي «حركة اليوم» على حركة فعلية —————
  await page.goto(`${BASE}/cashbox`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: /حركة مباشرة/ }).first().click();
  await page.locator('input[inputmode="decimal"]').first().fill("1234");
  await page.locator('input[placeholder*="إيجار"]').first().fill(MOVEMENT_DESC);
  await page.getByRole("button", { name: "تسجيل الحركة" }).click();
  await page
    .getByText("تم تسجيل الحركة")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => report.problems.push(`${viewport.name}: لم يظهر تأكيد تسجيل الحركة`));
  entry.seededVoucher = await page
    .getByText(MOVEMENT_DESC)
    .first()
    .isVisible()
    .catch(() => false);

  // ————— 2) الشاشة الرئيسية —————
  // نصفر سجل الأخطاء بعد خطوة التهيئة حتى يحكم الفحص على الشاشة الرئيسية وحدها.
  consoleErrors.length = 0;
  pageErrors.length = 0;
  const response = await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  entry.status = response?.status() ?? 0;
  if (entry.status !== 200) report.problems.push(`${viewport.name}: / أعاد ${entry.status}`);

  await page.waitForFunction(
    () => (document.querySelector("main")?.innerText || "").includes("ديون العملاء"),
    { timeout: 15000 },
  ).catch(() => report.problems.push(`${viewport.name}: لم تُرسم الشاشة الرئيسية خلال 15 ثانية`));

  const audit = await page.evaluate(() => {
    const text = document.body.innerText;
    const main = document.querySelector("main") || document.body;
    const headerTitle = document.querySelector("header h1")?.textContent?.trim() ?? "";
    const navHome = Array.from(document.querySelectorAll("nav a")).find(
      (a) => a.getAttribute("href") === "/",
    );
    const section = Array.from(main.querySelectorAll("section")).find((s) =>
      (s.innerText || "").includes("حركة اليوم"),
    );
    const log = Array.from(main.querySelectorAll("section")).find((s) =>
      (s.innerText || "").includes("آخر العمليات"),
    );
    const box = section?.getBoundingClientRect();
    const logBox = log?.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    // المقارنة مع عرض كتلة أخرى بعرض الشاشة (سجل العمليات) لا مع عرض الحاوية
    // نفسه، لأن الحاوية تحمل حشوة داخلية تجعل عرضها أكبر من عرض الأبناء.
    const rowBox = log?.parentElement?.getBoundingClientRect();
    return {
      headerTitle,
      navHomeLabel: navHome?.textContent?.trim() ?? "",
      hasWelcome: text.includes("أهلاً بك"),
      removedCards: {
        suppliersDues: text.includes("مستحقات الموردين"),
        lowStockCard: text.includes("مواد تحت الحد"),
        monthCard: text.includes("خدمات الشهر") || text.includes("مبيعات الشهر"),
      },
      movementCardFound: Boolean(section),
      fullWidth: box ? Math.round(box.width) : 0,
      contentWidth: rowBox ? Math.round(rowBox.width) : Math.round(mainBox.width),
      spansContent: Boolean(box && rowBox && Math.abs(box.width - rowBox.width) <= 2),
      aboveLog: Boolean(box && logBox && box.top < logBox.top),
      rightEdgeAligned: Boolean(box && logBox && Math.abs(box.right - logBox.right) <= 2),
      buttonLabel: section?.querySelector("button")?.innerText.replace(/\s+/g, " ").trim() ?? "",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  entry.audit = audit;

  if (audit.headerTitle !== "النظام الرئيسي")
    report.problems.push(`${viewport.name}: عنوان الترويسة «${audit.headerTitle}» بدل «النظام الرئيسي»`);
  if (audit.navHomeLabel !== "النظام الرئيسي")
    report.problems.push(`${viewport.name}: تسمية القائمة «${audit.navHomeLabel}» بدل «النظام الرئيسي»`);
  if (audit.hasWelcome) report.problems.push(`${viewport.name}: رسالة الترحيب ما زالت ظاهرة`);
  for (const [key, present] of Object.entries(audit.removedCards)) {
    if (present) report.problems.push(`${viewport.name}: الكرت المحذوف ما زال ظاهرًا (${key})`);
  }
  if (!audit.movementCardFound) report.problems.push(`${viewport.name}: كرت «حركة اليوم» غير موجود`);
  if (!audit.spansContent)
    report.problems.push(
      `${viewport.name}: كرت «حركة اليوم» ليس بعرض الشاشة (${audit.fullWidth} من ${audit.contentWidth})`,
    );
  if (!audit.aboveLog) report.problems.push(`${viewport.name}: كرت «حركة اليوم» ليس فوق «آخر العمليات»`);
  if (!audit.rightEdgeAligned)
    report.problems.push(`${viewport.name}: حدّ كرت «حركة اليوم» غير محاذٍ لباقي البطاقات`);
  if (audit.overflow > 0) report.problems.push(`${viewport.name}: تجاوز أفقي ${audit.overflow}px`);
  if (consoleErrors.length > 0)
    report.problems.push(`${viewport.name}: أخطاء console في الشاشة الرئيسية (${consoleErrors.length})`);
  if (pageErrors.length > 0)
    report.problems.push(`${viewport.name}: أخطاء صفحة غير ملتقطة (${pageErrors.length})`);

  await page.screenshot({
    path: `${OUT_DIR}/${viewport.name}-collapsed.png`,
    fullPage: false,
  });

  // ————— 3) النقر على الكرت يعرض كل حركات اليوم —————
  await page.getByRole("button", { name: /حركة اليوم/ }).first().click();
  const panel = page.locator("#today-movements");
  await panel.waitFor({ timeout: 8000 }).catch(() => {
    report.problems.push(`${viewport.name}: لوحة حركات اليوم لم تُفتح عند النقر`);
  });
  entry.expandedText = (await panel.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
  const expandedCount = await panel
    .locator(".list-row")
    .count()
    .catch(() => 0);
  entry.expandedRows = expandedCount;
  if (expandedCount < 1)
    report.problems.push(`${viewport.name}: لوحة حركات اليوم فارغة بعد إنشاء سند اليوم`);
  if (!entry.expandedText.includes(MOVEMENT_DESC))
    report.problems.push(`${viewport.name}: البيان الجديد لا يظهر في حركات اليوم`);

  await page.screenshot({
    path: `${OUT_DIR}/${viewport.name}-expanded.png`,
    fullPage: false,
  });

  await context.close();
  report.viewports.push(entry);
}

await browser.close();

report.ok = report.problems.length === 0;
writeFileSync(`${OUT_DIR}/qa.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, problems: report.problems }, null, 2));
