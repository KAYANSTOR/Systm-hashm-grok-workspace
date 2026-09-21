/**
 * اختبار حسابات المصروفات حسب الفئة (الخيار الثاني).
 * كل فئة مصروف → حساب مستقل في الدفتر بدل التجميع على «مشتريات».
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PURCHASES_ACCOUNT_ID,
  expenseAccountId,
  expenseAccountName,
  expenseAccountFor,
  KNOWN_EXPENSE_CATEGORIES,
} from "./expense-account.ts";

describe("expense accounts by category", () => {
  it("derives a stable account id from the category", () => {
    assert.equal(expenseAccountId("إيجار"), "expense:إيجار");
    // ثابت: نفس الفئة → نفس المعرّف (إعادة الترحيل لا تُكرّر الحساب)
    assert.equal(expenseAccountId("إيجار"), expenseAccountId("إيجار"));
  });

  it("maps every known category to its own account (never purchases)", () => {
    for (const category of KNOWN_EXPENSE_CATEGORIES) {
      assert.equal(expenseAccountFor({ category }), `expense:${category}`);
      assert.notEqual(expenseAccountFor({ category }), PURCHASES_ACCOUNT_ID);
      assert.equal(expenseAccountName(category), `مصروف ${category}`);
    }
  });

  it("falls back to «أخرى» for empty or whitespace categories", () => {
    assert.equal(expenseAccountFor({ category: "" }), "expense:أخرى");
    assert.equal(expenseAccountFor({ category: "  " }), "expense:أخرى");
    assert.equal(expenseAccountFor({} as { category: string }), "expense:أخرى");
  });

  it("trims custom categories so 'نقل وشحن ' and 'نقل وشحن' share one account", () => {
    assert.equal(expenseAccountId("نقل وشحن "), expenseAccountId("نقل وشحن"));
  });

  it("keeps the purchases account exclusively for purchase invoices", () => {
    assert.equal(PURCHASES_ACCOUNT_ID, "purchases");
  });
});
