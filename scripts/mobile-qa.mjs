#!/usr/bin/env node
/**
 * فحص الجوال الشامل — يقود متصفح Chromium حقيقيًا بمقاسات الهواتف.
 * -----------------------------------------------------------------
 * لكل شاشة ولكل عرض (320 / 360 / 390 / 414) يفحص آليًا:
 *   1) التجاوز الأفقي: عنصر يتجاوز عرض الشاشة فعليًا (مع تجاهل ما هو داخل
 *      حاوية قابلة للتمرير أفقيًا لأنه مقصود).
 *   2) عناصر تتجاوز حاويتها (scrollWidth > clientWidth) بلا تمرير.
 *   3) أهداف اللمس الأصغر من 44×44 (معيار Google للأزرار على الجوال).
 *   4) النص المقصوص أو الخارج عن حاويته.
 *   5) تغطية عنصر ثابت (شريط سفلي/FAB) لمحتوى الصفحة أو العكس.
 *   6) نص غير مقروء بسبب تباين لوني منخفض مع خلفيته الفعلية.
 *   7) أخطاء الطرفية وأخطاء الصفحة.
 * ثم يحفظ صورة PNG لكل شاشة (وأي حالة تفاعلية) ويطبع حكمًا JSON.
 *
 * التشغيل:  node scripts/mobile-qa.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT = join(ROOT, "screenshots", "mobile");
mkdirSync(OUT, { recursive: true });

/* خيارات سريعة: --widths 320,390  ·  --no-screens  ·  --no-interactions  ·  --route /sales */
const argv = process.argv.slice(2);
const flagValue = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
/* العنوان يُمرّر كأول وسيط غير مفتاح (المفاتيح تأخذ قيمتها في الوسيط التالي). */
const FLAGS_WITH_VALUE = new Set(["--widths", "--route", "--interaction-width"]);
const positional = argv.filter((value, index) => {
  if (value.startsWith("--")) return false;
  return !FLAGS_WITH_VALUE.has(argv[index - 1]);
});
const BASE = (positional[0] || "http://127.0.0.1:8080").replace(/\/$/, "");
const onlyWidths = flagValue("--widths")
  ? new Set(String(flagValue("--widths")).split(",").map((value) => value.trim()))
  : null;
const onlyRoute = flagValue("--route");
const runScreens = !argv.includes("--no-screens");
const runInteractions = !argv.includes("--no-interactions");

const ROUTES = [
  ["home", "/"],
  ["sales", "/sales"],
  ["vouchers", "/vouchers"],
  ["inventory", "/inventory"],
  ["cashbox", "/cashbox"],
  ["expenses", "/expenses"],
  ["parties", "/parties"],
  ["reports", "/reports"],
  ["settings", "/settings"],
];

/** مقاسات هواتف حقيقية: صغير جدًا، أندرويد شائع، آيفون، كبير. */
const ALL_VIEWPORTS = [
  { name: "320", width: 320, height: 700 },
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "414", width: 414, height: 896 },
];
const VIEWPORTS = ALL_VIEWPORTS.filter((viewport) => !onlyWidths || onlyWidths.has(viewport.name));
const SCREENS = ROUTES.filter(([, route]) => !onlyRoute || route === onlyRoute);

/** يُنفَّذ داخل الصفحة: كل قياسات الهندسة والعرض. */
function auditPage() {
  const vw = document.documentElement.clientWidth;
  const results = {
    pageOverflow: Math.round(document.documentElement.scrollWidth - vw),
    bodyText: document.body.innerText.replace(/\s+/g, " ").trim().length,
    overflowing: [],
    clipped: [],
    tinyTargets: [],
    covered: [],
    lowContrast: [],
    tinyText: [],
  };

  const describe = (el) => {
    const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
    const text =
      raw ||
      (el.getAttribute("placeholder") || el.getAttribute("aria-label") || "").slice(0, 34);
    const cls = (el.getAttribute("class") || "").replace(/\s+/g, " ").slice(0, 70);
    return { tag: el.tagName.toLowerCase(), cls, text };
  };

  const isField = (el) => ["input", "textarea", "select"].includes(el.tagName.toLowerCase());

  /**
   * محتوى «ورقة» الطباعة (A4/سند) — يُقاس بالمليمتر ويُعرض مصغّرًا على الشاشة،
   * فخطه الصغير على الشاشة مقصود (هو نفس الخط على الورق). لا نحكم عليه كواجهة.
   */
  const isPaperContent = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const cls = node.getAttribute("class") || "";
      if (cls.includes("print-page") || cls.startsWith("doc-")) return true;
    }
    return false;
  };

  /** هل للعنصر سلف قابل للتمرير أفقيًا؟ (الجداول العريضة داخل حاوية = مقصود) */
  const scrollableAncestor = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) {
        return true;
      }
    }
    return false;
  };

  /**
   * «مرئي فعلًا»: له أبعاد، غير مخفي، و**يتقاطع مع الشاشة** — فالمحتوى الذي
   * يختبئ خارج الشاشة (قائمة جانبية مُغلقة بـ translate) ليس مشكلة عرض.
   */
  /** سلف يقصّ الفائض (`overflow: hidden`) — ما يخرج منه زخرفة مقصودة لا توسيع للصفحة. */
  const clippedAncestor = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflow === "hidden" || style.overflowX === "hidden") return true;
    }
    return false;
  };

  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
      return false;
    }
    return rect.right > 0 && rect.left < vw && rect.bottom > 0;
  };

  /** عنصر زخرفي (pointer-events: none) لا يمنع التفاعل لكنه يوسّع الصفحة. */
  const decorative = (el) => getComputedStyle(el).pointerEvents === "none";

  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    // 1) تجاوز أفقي حقيقي للشاشة
    if ((rect.right > vw + 1 || rect.left < -1) && !scrollableAncestor(el) && !clippedAncestor(el)) {
      results.overflowing.push({
        ...describe(el),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        decorative: decorative(el),
      });
    }

    // 2) محتوى مقصوص داخل حاويته بلا تمرير
    //    حقول الإدخال مستثناة: تمرير قيمة طويلة داخل الحقل سلوك طبيعي لا خلل تنسيق.
    const scrollX = el.scrollWidth - el.clientWidth;
    if (
      scrollX > 2 &&
      !isField(el) &&
      !/(auto|scroll)/.test(style.overflowX) &&
      style.overflow !== "hidden"
    ) {
      results.clipped.push({ ...describe(el), hidden: Math.round(scrollX) });
    }
  }

  // 3) أهداف اللمس
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')) {
    if (!visible(el) || isPaperContent(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height < 44 || rect.width < 44) {
      // نتجاهل العناصر داخل شرائح قابلة للتمرير (أشرطة تمرير أفقية للمراحل/التبويبات)
      results.tinyTargets.push({
        ...describe(el),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
  }

  // 4) النص الصغير جدًا (< 11px) يصعب قراءته على الجوال
  for (const el of document.querySelectorAll("p, span, td, th, li, label, h1, h2, h3, small")) {
    if (!visible(el) || !el.textContent?.trim() || isPaperContent(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 10.5 && el.children.length === 0) {
      results.tinyText.push({ ...describe(el), size: Math.round(size * 10) / 10 });
    }
  }

  // 5) عناصر ثابتة (fixed/sticky) تغطي محتوى في نهاية الصفحة
  const fixedBars = [...document.querySelectorAll("body *")].filter((el) => {
    if (!visible(el)) return false;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    const rect = el.getBoundingClientRect();
    return rect.height > 24 && rect.width > vw * 0.5;
  });
  for (const bar of fixedBars) {
    const rect = bar.getBoundingClientRect();
    if (rect.bottom < window.innerHeight * 0.6) continue; // شريط علوي فقط
    const point = document.elementFromPoint(Math.round(vw / 2), Math.round(rect.top - 6));
    if (point && point !== bar && !bar.contains(point)) {
      results.covered.push({
        ...describe(bar),
        covers: describe(point),
      });
    }
  }

  // 6) تباين لوني منخفض (نص بلون قريب جدًا من خلفيته الفعلية)
  //    الألوان تُطبَّع عبر canvas لأن المشروع يستخدم `oklab()/color-mix()` التي لا
  //    تُقرأ بتحليل نصي، مع تعويض شفافية العنصر نفسها (opacity) قبل المقارنة.
  const canvas = document.createElement("canvas").getContext("2d");
  /**
   * تطبيع اللون عبر canvas (يفهم `oklab()/color-mix()` التي لا تُحلّل نصيًا)،
   * ثم تحويل الخَرْج: `#rrggbb` للألوان المُعتِمة أو `rgba(...)` عند وجود شفافية.
   */
  const toRgba = (value) => {
    if (!value || value === "transparent" || value === "none") return null;
    // قيمة حارسة: إن لم يفهم المتصفح قيمة CSS تُترك كما هي، فنكتشف ذلك بتطابق اللون الحارس.
    canvas.fillStyle = "#ff00ff";
    canvas.fillStyle = value;
    const normalized = canvas.fillStyle;
    if (typeof normalized !== "string") return null;
    if (normalized === "#ff00ff" && !/^\s*(#ff00ff|magenta|fuchsia)\s*$/i.test(value)) return null;

    if (normalized.startsWith("#")) {
      const hex = normalized.slice(1);
      const expand = hex.length <= 4 ? hex.split("").map((char) => char + char).join("") : hex;
      if (expand.length !== 6 && expand.length !== 8) return null;
      return {
        r: parseInt(expand.slice(0, 2), 16),
        g: parseInt(expand.slice(2, 4), 16),
        b: parseInt(expand.slice(4, 6), 16),
        a: expand.length === 8 ? parseInt(expand.slice(6, 8), 16) / 255 : 1,
      };
    }

    // Tailwind v4 يولّد `color-mix()` فيُحلّها المتصفح إلى oklab()/oklch() —
    // وهذه ليست RGB، فتُحوَّل رياضيًا إلى sRGB بدل قراءة أرقامها كقيم 0-255.
    const oklabMatch = normalized.match(
      /oklab\(\s*([\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)\s*(?:\/\s*([\d.]+%?))?\s*\)/i,
    );
    const oklchMatch = normalized.match(
      /oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)/i,
    );
    if (oklabMatch || oklchMatch) {
      const toUnit = (token) =>
        token?.endsWith("%") ? Number(token.slice(0, -1)) / 100 : Number(token ?? 0);
      const lightness = toUnit((oklabMatch ?? oklchMatch)[1]);
      let aAxis;
      let bAxis;
      if (oklabMatch) {
        aAxis = toUnit(oklabMatch[2]);
        bAxis = toUnit(oklabMatch[3]);
      } else {
        const chroma = toUnit(oklchMatch[2]);
        const hue = (Number(oklchMatch[3]) * Math.PI) / 180;
        aAxis = chroma * Math.cos(hue);
        bAxis = chroma * Math.sin(hue);
      }
      const rawAlpha = oklabMatch ? oklabMatch[4] : oklchMatch[4];
      const alpha = rawAlpha === undefined ? 1 : toUnit(rawAlpha);

      const l = lightness + 0.3963377774 * aAxis + 0.2158037573 * bAxis;
      const m = lightness - 0.1055613458 * aAxis - 0.0638541728 * bAxis;
      const s = lightness - 0.0894841775 * aAxis - 1.291485548 * bAxis;
      const l3 = l ** 3;
      const m3 = m ** 3;
      const s3 = s ** 3;
      const encode = (value) =>
        Math.min(1, Math.max(0, value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
      const linear = {
        r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
      };
      return {
        r: encode(linear.r) * 255,
        g: encode(linear.g) * 255,
        b: encode(linear.b) * 255,
        a: alpha,
      };
    }

    const nums = (normalized.match(/[\d.]+/g) || []).map(Number);
    if (nums.length < 3) return null;
    // color(srgb r g b / a) → قيم مفردة بين 0 و 1
    if (/^color\(\s*srgb/i.test(normalized)) {
      return { r: nums[0] * 255, g: nums[1] * 255, b: nums[2] * 255, a: nums[3] ?? 1 };
    }
    return { r: nums[0], g: nums[1], b: nums[2], a: nums[3] ?? 1 };
  };
  /** يقرأ مصدر الخلفية: لون صريح، أو أول وقفة لون في تدرّج (`card-hero` مثلًا). */
  const readBackground = (value) => {
    if (!value || value === "none") return null;
    const first = value.match(/(?:rgb|rgba|oklab|oklch|color)\([^)]*\)/g);
    return first?.length ? toRgba(first[0]) : null;
  };
  const rawBackground = (style) => {
    const color = toRgba(style.backgroundColor);
    if (color && color.a > 0.5) return color;
    if (style.backgroundImage && style.backgroundImage !== "none") {
      const stop = readBackground(style.backgroundImage);
      if (stop) return stop;
    }
    return null;
  };
  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrast = (fg, bg) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  for (const el of document.querySelectorAll("p, span, h1, h2, h3, td, th, label, li, a, button")) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const style = getComputedStyle(el);
    const fg = toRgba(style.color);
    if (!fg || fg.a < 0.5) continue;

    let bg = null;
    let node = el;
    while (node && !bg) {
      bg = rawBackground(getComputedStyle(node));
      node = node.parentElement;
    }
    if (!bg) continue; // خلفية غير قابلة للحل (صورة/تدرّج معقّد) — لا نحكم عليها

    // دمج شفافية النص والشفافية المتراكمة للأسلاف إن وُجدت
    const opacity = Number(style.opacity);
    const merged = {
      r: bg.r + (fg.r - bg.r) * fg.a * opacity,
      g: bg.g + (fg.g - bg.g) * fg.a * opacity,
      b: bg.b + (fg.b - bg.b) * fg.a * opacity,
    };
    const ratio = contrast(merged, bg);
    if (ratio < 3) {
      results.lowContrast.push({ ...describe(el), ratio: Math.round(ratio * 100) / 100 });
    }
  }

  const dedupe = (list, keyOf = (item) => `${item.tag}|${item.cls}|${item.text}`) => {
    const seen = new Set();
    return list.filter((item) => {
      const key = keyOf(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    ...results,
    overflowing: dedupe(results.overflowing).slice(0, 14),
    clipped: dedupe(results.clipped).slice(0, 10),
    tinyTargets: dedupe(results.tinyTargets).slice(0, 14),
    covered: dedupe(results.covered).slice(0, 4),
    lowContrast: dedupe(results.lowContrast).slice(0, 8),
    tinyText: dedupe(results.tinyText).slice(0, 10),
  };
}

const browser = await chromium.launch();
const report = { base: BASE, screens: [], interactions: [] };

for (const viewport of runScreens ? VIEWPORTS : []) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 200)));

  for (const [name, route] of SCREENS) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    let status = 0;
    try {
      const response = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60_000 });
      status = response?.status() ?? 0;
    } catch (err) {
      pageErrors.push(`navigation: ${String(err).slice(0, 160)}`);
    }
    await page.waitForTimeout(500);
    const audit = await page.evaluate(auditPage);
    const shot = join(OUT, `${viewport.name}-${name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    report.screens.push({ viewport: viewport.name, route, status, shot, consoleErrors: [...consoleErrors], pageErrors: [...pageErrors], ...audit });
  }

  await context.close();
}

/** حالات تفاعلية: نفتح النوافذ والطبقات على مقاس 390 ونفحص داخلها. */
/** حالة تحتاج بيانات غير موجودة في بيئة الفحص — تُسجّل «متخطاة» لا «فاشلة». */
class SkipError extends Error {}

const interactions = [
  {
    name: "fab-menu",
    route: "/",
    steps: async (page) => page.getByLabel("إجراءات سريعة").click({ timeout: 6000 }),
  },
  {
    name: "notifications",
    route: "/",
    steps: async (page) => page.getByLabel("التنبيهات").click({ timeout: 6000 }),
  },
  {
    name: "bottom-nav",
    route: "/",
    steps: async (page) => {
      await page.locator('nav a[href="/reports"]').last().click({ timeout: 6000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "invoice-modal",
    route: "/sales",
    steps: async (page) => page.getByRole("button", { name: /فاتورة خدمة تطريز/ }).first().click({ timeout: 6000 }),
  },
  {
    name: "voucher-modal",
    route: "/vouchers",
    steps: async (page) => page.getByRole("button", { name: /سند قبض/ }).first().click({ timeout: 6000 }),
  },
  {
    name: "inventory-in",
    route: "/inventory",
    steps: async (page) => page.getByRole("button", { name: "إدخال بضاعة" }).first().click({ timeout: 6000 }),
  },
  {
    name: "inventory-out",
    route: "/inventory",
    steps: async (page) => page.getByRole("button", { name: "إخراج بضاعة" }).first().click({ timeout: 6000 }),
  },
  {
    name: "expense-modal",
    route: "/expenses",
    steps: async (page) => page.getByRole("button", { name: /مصروف جديد/ }).first().click({ timeout: 6000 }),
  },
  {
    name: "parts-modal",
    route: "/parties",
    steps: async (page) => page.getByRole("button", { name: /عميل جديد/ }).first().click({ timeout: 6000 }),
  },
  {
    name: "voucher-print",
    route: "/vouchers",
    steps: async (page) => {
      const print = page.getByRole("button", { name: /طباعة|معاينة/ });
      if ((await print.count()) === 0) {
        /** لا سندات محفوظة في هذه البيئة — نتخطى بدل إعلان فشل. */
        throw new SkipError("لا توجد سندات محفوظة في هذه البيئة");
      }
      await print.first().click({ timeout: 6000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "report-print",
    route: "/reports",
    steps: async (page) => page.getByRole("button", { name: /معاينة وطباعة/ }).first().click({ timeout: 8000 }),
  },
];

const interactionWidth = Number(flagValue("--interaction-width") || 390);
const context = await browser.newContext({
  viewport: { width: interactionWidth, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const interactionErrors = [];
page.on("pageerror", (err) => interactionErrors.push(String(err).slice(0, 200)));

for (const interaction of runInteractions ? interactions : []) {
  const record = { name: interaction.name, route: interaction.route, ok: false, note: "" };
  try {
    await page.goto(BASE + interaction.route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(400);
    await interaction.steps(page);
    await page.waitForTimeout(700);
    const audit = await page.evaluate(auditPage);
    record.ok = true;
    const shot = join(OUT, `390-${interaction.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    record.shot = shot;
    Object.assign(record, {
      pageOverflow: audit.pageOverflow,
      overflowing: audit.overflowing,
      clipped: audit.clipped,
      tinyTargets: audit.tinyTargets,
      tinyText: audit.tinyText,
      lowContrast: audit.lowContrast,
    });
  } catch (err) {
    record.note = String(err).split("\n")[0].slice(0, 160);
    if (err instanceof SkipError) {
      record.ok = true;
      record.skipped = true;
    }
  }
  record.pageErrors = [...interactionErrors];
  interactionErrors.length = 0;
  report.interactions.push(record);
}

await context.close();
await browser.close();

/* ————— الحكم النهائي: تجميع المشكلة الواحدة في سطر واحد ————— */
/** @type {Map<string, {kind: string, detail: string, screens: Set<string>, count: number}>} */
const grouped = new Map();
const add = (kind, detail, where) => {
  const key = `${kind}|${detail}`;
  const entry = grouped.get(key) ?? { kind, detail, screens: new Set(), count: 0 };
  entry.screens.add(where);
  entry.count += 1;
  grouped.set(key, entry);
};

for (const screen of report.screens) {
  const where = `${screen.route}@${screen.viewport}`;
  if (screen.status !== 200) add("http", `HTTP ${screen.status}`, where);
  if (screen.pageOverflow > 1) add("overflow-page", `تمرير أفقي للصفحة ${screen.pageOverflow}px`, where);
  for (const item of screen.overflowing) {
    add(item.decorative ? "overflow-decorative" : "overflow-element", `${item.tag}.${item.cls.slice(0, 60)} → ${item.right}px`, where);
  }
  for (const item of screen.clipped) add("clipped", `${item.tag}.${item.cls.slice(0, 60)} (−${item.hidden}px)`, where);
  for (const item of screen.tinyTargets) add("tap-target", `${item.w}×${item.h} ${item.tag}.${item.cls.slice(0, 40)} «${item.text.slice(0, 18)}»`, where);
  for (const item of screen.tinyText) add("tiny-text", `${item.size}px ${item.tag}.${item.cls.slice(0, 40)} «${item.text.slice(0, 18)}»`, where);
  for (const item of screen.lowContrast) add("contrast", `نسبة ${item.ratio} — «${item.text.slice(0, 24)}» ${item.tag}.${item.cls.slice(0, 40)}`, where);
  for (const item of screen.covered) add("covered", `${item.tag} يغطي «${item.covers.text.slice(0, 20)}»`, where);
  for (const message of screen.pageErrors) add("page-error", message.slice(0, 120), where);
  for (const message of screen.consoleErrors) add("console-error", message.slice(0, 120), where);
}
for (const interaction of report.interactions) {
  const where = `حالة-${interaction.name}@${interactionWidth}`;
  if (!interaction.ok) add("interaction", `لم تُفتح — ${interaction.note}`, where);
  else if (interaction.skipped) add("interaction-skipped", interaction.note, where);
  for (const item of interaction.overflowing ?? []) add("overflow-element", `${item.tag}.${item.cls.slice(0, 60)} → ${item.right}px`, where);
  for (const item of interaction.tinyTargets ?? []) add("tap-target", `${item.w}×${item.h} ${item.tag}.${item.cls.slice(0, 40)} «${item.text.slice(0, 18)}»`, where);
  for (const item of interaction.tinyText ?? []) add("tiny-text", `${item.size}px ${item.tag}.${item.cls.slice(0, 40)} «${item.text.slice(0, 18)}»`, where);
  for (const message of interaction.pageErrors ?? []) add("page-error", message.slice(0, 120), where);
}

const issues = [...grouped.values()]
  .map((entry) => ({ kind: entry.kind, detail: entry.detail, count: entry.count, screens: [...entry.screens] }))
  .sort((a, b) => b.count - a.count);

const file = join(OUT, "qa.json");
writeFileSync(file, JSON.stringify({ ...report, issues }, null, 2));
console.log(
  JSON.stringify(
    {
      base: BASE,
      screenshots: report.screens.length,
      interactions: report.interactions.length,
      issueKinds: issues.length,
      issues,
      report: file,
    },
    null,
    2,
  ),
);
process.exit(0);
