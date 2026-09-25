#!/usr/bin/env node
/**
 * يطبع ملخصًا مقروءًا لتقرير فحص الجوال `screenshots/mobile/qa.json`.
 * كل نوع مشكلة في سطر واحد مع عدد مرات ظهوره والشاشات المتأثرة.
 *
 *   node scripts/mobile-qa-summary.mjs [--all]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const report = JSON.parse(readFileSync(join(ROOT, "screenshots", "mobile", "qa.json"), "utf8"));
const showAll = process.argv.includes("--all");
const limit = showAll ? Infinity : 14;

const KIND_LABEL = {
  http: "خطأ HTTP",
  "overflow-page": "تمرير أفقي للصفحة",
  "overflow-element": "عنصر خارج الشاشة",
  "overflow-decorative": "زخرفة تتجاوز الشاشة",
  clipped: "محتوى مقصوص",
  "tap-target": "هدف لمس صغير",
  "tiny-text": "نص صغير",
  contrast: "تباين منخفض",
  covered: "عنصر ثابت يغطي محتوى",
  "page-error": "خطأ صفحة",
  "console-error": "خطأ طرفية",
  interaction: "حالة تفاعلية لم تُفتح",
  "interaction-skipped": "حالة متخطاة (لا بيانات)",
};

console.log(`قاعدة: ${report.base} · شاشات: ${report.screens.length} · حالات تفاعلية: ${report.interactions.length}`);
console.log(`أنواع المشاكل: ${report.issues.length}\n`);

for (const issue of report.issues) {
  const label = KIND_LABEL[issue.kind] ?? issue.kind;
  const screens = issue.screens.slice(0, 6).join(", ");
  const rest = issue.screens.length > 6 ? ` +${issue.screens.length - 6}` : "";
  console.log(`• [${label}] ×${issue.count}  ${issue.detail.split("\n")[0]}`);
  console.log(`    ${screens}${rest}`);
}

for (const kind of Object.keys(KIND_LABEL)) {
  const list = report.issues.filter((issue) => issue.kind === kind);
  if (list.length === 0) continue;
  console.log(`\n—— ${KIND_LABEL[kind]} (${list.length} نوعًا) ——`);
  for (const issue of list.slice(0, limit)) {
    console.log(`  ×${issue.count} ${issue.detail.split("\n")[0]}`);
  }
}
