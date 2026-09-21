import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInputError, parseAmountStrict } from "./utils.ts";

/**
 * حماية إدخال المبالغ: كانت `parseFloat` تُسقط ما بعد الرقم بصمت
 * ("12س" → 12، "1.2.5" → 1.2) فيُحفظ مبلغ غير الذي كتبه المستخدم.
 */
test("يقبل رقمًا عربيًا أو إنجليزيًا واحدًا صحيحًا", () => {
  assert.deepEqual(parseAmountStrict("1500"), { ok: true, value: 1500 });
  assert.deepEqual(parseAmountStrict("1500.50"), { ok: true, value: 1500.5 });
  assert.deepEqual(parseAmountStrict("١٢٥٠٫٥"), { ok: true, value: 1250.5 });
  assert.deepEqual(parseAmountStrict("1,500"), { ok: true, value: 1500 });
  assert.deepEqual(parseAmountStrict(0), { ok: true, value: 0 });
});

test("يرفض النص المخلوط بدل قراءته جزئيًا", () => {
  assert.deepEqual(parseAmountStrict("12س"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseAmountStrict("1.2.5"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseAmountStrict("abc"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseAmountStrict("100-"), { ok: false, reason: "invalid" });
});

test("يميّز الفراغ عن الرقم السالب", () => {
  assert.deepEqual(parseAmountStrict(""), { ok: false, reason: "empty" });
  assert.deepEqual(parseAmountStrict("   "), { ok: false, reason: "empty" });
  assert.deepEqual(parseAmountStrict(-5), { ok: false, reason: "negative" });
  assert.deepEqual(parseAmountStrict(Number.NaN), { ok: false, reason: "invalid" });
});

test("رسالة الخطأ تذكر اسم الحقل وتوضح الصيغة", () => {
  assert.match(amountInputError("invalid", "الكمية"), /الكمية غير صحيح/);
  assert.match(amountInputError("invalid", "الكمية"), /1500/);
  assert.match(amountInputError("empty", "المبلغ"), /أدخل المبلغ/);
  assert.match(amountInputError("negative", "سعر الوحدة"), /سعر الوحدة لا يمكن/);
});
