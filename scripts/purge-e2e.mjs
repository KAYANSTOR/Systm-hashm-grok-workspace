/**
 * فحص شامل لتدفق «حذف وتصفية قاعدة البيانات» عبر الواجهة الحقيقية
 * -----------------------------------------------------------------
 * يُعيد إنتاج شكوى صاحب المشروع حرفيًا: «عندما أفعّل حذف وتصفية قاعدة البيانات
 * لا يتم حذف شيء لا في السحابة ولا في الجهاز» — ثم يتأكد أن الإصلاح يعمل:
 *
 *   1. ينشئ **عميلًا حقيقيًا** من شاشة العملاء (يُرحَّل إلى قاعدة البيانات عبر الطابور).
 *   2. يتأكد أن العميل وصل فعلًا للخادم (يظهر بعد إعادة تحميل الصفحة من الخادم).
 *   3. ينفّذ التصفية من شاشة الإعدادات (عبارة التأكيد + التأكيد الأخير).
 *   4. يعيد تحميل الصفحة ويؤكد أن **بيانات الخادم نفسها** فُرِّغت (لا الإسقاط المحلي فقط).
 *
 * التشغيل: node scripts/purge-e2e.mjs   (يحتاج خادم التطوير على 8080)
 * ⚠️ إجراء مدمِّر: يشغّله الوكيل على قاعدة معاينة/PGlite فقط، لا على الإنتاج.
 */
import { chromium } from "playwright";

const BASE = process.env.PURGE_E2E_BASE || "http://127.0.0.1:8080";
const CUSTOMER = `عميل فحص ${Date.now()}`;
const RESET_PHRASE = "حذف الكل";

const problems = [];
const check = (name, ok, detail = "") => {
  if (!ok) problems.push(name);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` → ${detail}` : ""}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-YE" });
const page = await context.newPage();
page.on("dialog", (dialog) => dialog.accept());
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 200)));

// 1) إنشاء عميل حقيقي من الواجهة
await page.goto(`${BASE}/parties`, { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: "عميل جديد" }).first().click({ timeout: 10000 });
await page.getByPlaceholder("الاسم الكامل").fill(CUSTOMER);
await page.getByRole("button", { name: "حفظ" }).first().click({ timeout: 10000 });
await page.waitForTimeout(500);
check("إنشاء عميل جديد من شاشة العملاء", !pageErrors.length, pageErrors[0] || "");

// 2) انتظار ترحيل العملية إلى الخادم ثم التأكد أن الخادم يحملها
await page.waitForTimeout(6000);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const onServerBefore = await page.getByText(CUSTOMER, { exact: false }).count();
check("العميل وصل إلى قاعدة البيانات (ظهر بعد إعادة التحميل من الخادم)", onServerBefore > 0);

// 3) تنفيذ التصفية من شاشة الإعدادات
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);
// القائمة الجانبية على الحاسوب وشبكة الجوال تختلفان في الوسم، فنبحث بالوسمين.
await page
  .locator('nav[aria-label="أقسام الإعدادات"] button:visible', { hasText: "منطقة الخطر" })
  .first()
  .click({ timeout: 10000 });
await page.getByRole("button", { name: /بدء حذف وتصفية قاعدة البيانات/ }).click({ timeout: 10000 });
await page.locator('input[placeholder="حذف الكل"]').fill(RESET_PHRASE);
await page.getByRole("button", { name: /تأكيد الحذف والتصفية الآن/ }).click({ timeout: 10000 });

// ننتظر إما رسالة نجاح أو رسالة خطأ لنعرف النتيجة الحقيقية
const outcome = await page
  .waitForFunction(
    () => {
      const text = document.body.innerText;
      if (text.includes("تم حذف وتصفية بيانات العمل بنجاح")) return "success";
      if (text.includes("تعذّر إتمام تصفية") || text.includes("تعذر")) return "error";
      return false;
    },
    { timeout: 25000 },
  )
  .then((handle) => handle.jsonValue())
  .catch(() => "timeout");
check("التصفية أبلغت عن النجاح", outcome === "success", `الناتج: ${outcome}`);

// 4) الحكم النهائي: هل فُرِّغت بيانات **الخادم** فعلًا؟
await page.waitForTimeout(3000);
await page.goto(`${BASE}/parties`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(3000);
const onServerAfter = await page.getByText(CUSTOMER, { exact: false }).count();
check(
  "بيانات الخادم فُرِّغت فعلًا (العميل لم يعد يظهر بعد إعادة القراءة من الخادم)",
  onServerAfter === 0,
  `مرات الظهور بعد التصفية: ${onServerAfter}`,
);

check("لا أخطاء صفحة أثناء التدفق كله", pageErrors.length === 0, pageErrors[0] || "");

await browser.close();
console.log(problems.length === 0 ? "\n✅ تدفق التصفية سليم بالكامل\n" : `\n❌ مشاكل: ${problems.join(" · ")}\n`);
process.exit(problems.length === 0 ? 0 : 1);
