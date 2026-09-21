import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInArabicWords, amountWords, numberToArabicWords } from "./numbers-ar.ts";

/**
 * التفقيط يُطبع على السندات والفواتير، وخطأ ترتيب الكلمات فيه يظهر مباشرة
 * للعميل على ورقة مطبوعة — لذلك يُقفل باختبارات صريحة.
 */
test("الأعداد المفردة والعشرات", () => {
  assert.equal(numberToArabicWords(0), "صفر");
  assert.equal(numberToArabicWords(1), "واحد");
  assert.equal(numberToArabicWords(11), "أحد عشر");
  assert.equal(numberToArabicWords(19), "تسعة عشر");
  assert.equal(numberToArabicWords(21), "واحد وعشرون");
  assert.equal(numberToArabicWords(99), "تسعة وتسعون");
});

test("المئات", () => {
  assert.equal(numberToArabicWords(100), "مئة");
  assert.equal(numberToArabicWords(200), "مئتان");
  assert.equal(numberToArabicWords(500), "خمسمئة");
  assert.equal(numberToArabicWords(234), "مئتان وأربعة وثلاثون");
});

test("الآلاف: العدد يسبق المعدود (ثلاثة آلاف لا آلاف ثلاثة)", () => {
  assert.equal(numberToArabicWords(1000), "ألف");
  assert.equal(numberToArabicWords(2000), "ألفان");
  assert.equal(numberToArabicWords(3000), "ثلاثة آلاف");
  assert.equal(numberToArabicWords(10000), "عشرة آلاف");
  assert.equal(numberToArabicWords(11000), "أحد عشر ألف");
  assert.equal(numberToArabicWords(1500), "ألف وخمسمئة");
  assert.equal(numberToArabicWords(250000), "مئتان وخمسون ألف");
});

test("الملايين والمليارات", () => {
  assert.equal(numberToArabicWords(1000000), "مليون");
  assert.equal(numberToArabicWords(2000000), "مليونان");
  assert.equal(numberToArabicWords(3000000), "ثلاثة ملايين");
  assert.equal(numberToArabicWords(2500000), "مليونان وخمسمئة ألف");
  assert.equal(numberToArabicWords(1000000000), "مليار");
});

test("صيغة السند: words بلا ذيل، وInArabicWords بذيل «فقط لا غير»", () => {
  assert.equal(amountWords(1500), "ألف وخمسمئة ريال يمني");
  assert.equal(amountInArabicWords(1500), "ألف وخمسمئة ريال يمني فقط لا غير");
  assert.equal(amountInArabicWords(0), "صفر ريال يمني فقط لا غير");
  assert.match(amountWords(1500.5), /فلس$/);
  assert.match(amountInArabicWords(1), /^واحد ريال يمني فقط لا غير$/);
});

test("يتعامل مع القيم غير الصالحة بلا كسر المستند", () => {
  assert.equal(numberToArabicWords(Number.NaN), "صفر");
  assert.equal(amountInArabicWords(Number.NaN), "صفر ريال يمني فقط لا غير");
  assert.equal(numberToArabicWords(-4200), "أربعة آلاف ومئتان");
});
