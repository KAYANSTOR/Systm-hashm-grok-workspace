#!/usr/bin/env node
// @ts-check
/**
 * تدقيق محاسبي قابل للتشغيل (بلا قاعدة بيانات خارجية).
 * ------------------------------------------------------
 * يبني مخطط قاعدة البيانات فعليًا من `migrations/*.sql` في PGlite، ثم يتحقق من
 * الثوابت المحاسبية التي كشف التدقيق (21 سبتمبر 2026) أنها كانت مكسورة:
 *
 *   1) فاتورة بيع نقدية مدفوعة كاملًا  → رصيد العميل = 0 (لا الإجمالي).
 *   2) فاتورة بيع آجلة                  → رصيد العميل = الإجمالي، الصندوق لم يتأثر.
 *   3) فاتورة بيع مدفوعة جزئيًا          → رصيد العميل = المتبقي.
 *   4) فاتورة مشتريات مدفوعة جزئيًا      → رصيد المورد = المتبقي.
 *   5) سند قبض من عميل                  → الصندوق +المبلغ، رصيد العميل −المبلغ.
 *   6) سند صرف لمورد                    → الصندوق −المبلغ، رصيد المورد −المبلغ.
 *   7) إلغاء فاتورة (حذف قيودها)         → يعود الرصيد والصندوق كما كانا.
 *   8) هجرة 0024 تُصلح الفواتير القديمة الناقصة، وآمنة لإعادة التنفيذ.
 *
 * قيود الفاتورة تُبنى من المصدر الحقيقي `src/domain/invoice-ledger-rows.ts`
 * الذي يستخدمه الخادم في `saveInvoice` و`syncLegacyData` — فأي تراجع عن الإصلاح
 * يُسقط هذا الفحص.
 *
 * التشغيل:  node --experimental-strip-types scripts/accounting-invariant-check.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { invoiceLedgerRows } from "../src/domain/invoice-ledger-rows.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "migrations");

const results = [];
function check(name, actual, expected) {
  const ok = Math.abs(Number(actual) - Number(expected)) < 1e-9;
  results.push({ name, ok, actual: Number(actual), expected: Number(expected) });
  console.log(`${ok ? "✅" : "❌"} ${name} → ${actual} (المتوقع ${expected})`);
}

const db = new PGlite();

// 1) المخطط الكامل كما يُطبَّق في الإنتاج/المعاينة
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();
await db.exec(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
);
for (const name of files) {
  const sql = await readFile(join(migrationsDir, name), "utf8");
  await db.transaction(async (tx) => {
    await tx.exec(sql);
    await tx.query("insert into _migrations (name) values ($1)", [name]);
  });
}
console.log(`🧱 طُبِّقت ${files.length} هجرة على PGlite بنجاح\n`);

// 2) كتابة قيود فاتورة كما يكتبها الخادم حرفيًا (من نفس الدالة)
async function insertInvoiceRows(invoice) {
  for (const row of invoiceLedgerRows(invoice)) {
    await db.query(
      `insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set amount=excluded.amount, debit=excluded.debit, credit=excluded.credit, party_id=excluded.party_id`,
      [
        row.id,
        row.accountId,
        row.partyId,
        row.amount,
        row.debit,
        row.credit,
        row.referenceType,
        row.referenceId,
        row.description,
        row.createdAt,
      ],
    );
  }
}

/** نفس قواعد شاشة الواجهة/`store.ts`: مجموع الصفوف لكل مستند ثم رصيد الطرف. */
async function partyBalance(partyId) {
  const rows = await db.query(
    `select id, account_id, debit, credit from financial_transactions where reference_id in (
       select reference_id from financial_transactions where party_id = $1 and reference_id is not null
     ) order by reference_id`,
    [partyId],
  );
  const grouped = new Map();
  for (const r of rows.rows) {
    const key = r.reference_id;
    if (!grouped.has(key)) grouped.set(key, { debit: 0, credit: 0, partyId });
    const g = grouped.get(key);
    if (r.account_id === "cash") continue; // الصندوق ليس أثرًا على الذمة
    g.debit += Number(r.debit) || 0;
    g.credit += Number(r.credit) || 0;
  }
  let balance = 0;
  for (const [, g] of grouped) balance += g.debit - g.credit;
  return balance;
}

async function cashBalance() {
  const rows = await db.query(
    "select coalesce(sum(debit),0) as din, coalesce(sum(credit),0) as dout from financial_transactions where account_id = 'cash'",
  );
  return Number(rows.rows[0].din) - Number(rows.rows[0].dout);
}

const now = "2026-09-21T10:00:00.000Z";
const baseInvoice = {
  id: "inv_cash",
  invoiceNumber: "INV-0001",
  type: "sale",
  paymentType: "cash",
  partyId: "cust_1",
  date: now,
  createdAt: now,
  items: [],
  subTotal: 1000,
  discount: 0,
  total: 1000,
  paidAmount: 1000,
  remainingAmount: 0,
  status: "paid",
  isApproved: true,
};

await db.query(
  `insert into parties (id, type, name, created_at) values ($1,'customer','عميل تجريبي',$2), ($3,'supplier','مورد تجريبي',$2)`,
  ["cust_1", now, "sup_1"],
);

// 1) بيع نقدي مدفوع كامل
await insertInvoiceRows(baseInvoice);
check("فاتورة بيع نقدية مدفوعة كاملًا: رصيد العميل", await partyBalance("cust_1"), 0);
check("فاتورة بيع نقدية مدفوعة كاملًا: الصندوق", await cashBalance(), 1000);

// 2) بيع آجل
await insertInvoiceRows({
  ...baseInvoice,
  id: "inv_credit",
  invoiceNumber: "INV-0002",
  paymentType: "deferred",
  paidAmount: 0,
  remainingAmount: 1000,
  status: "unpaid",
});
check("فاتورة بيع آجلة: رصيد العميل = الإجمالي", await partyBalance("cust_1"), 1000);
check("فاتورة بيع آجلة: الصندوق لم يتأثر", await cashBalance(), 1000);

// 3) بيع مدفوع جزئيًا
await insertInvoiceRows({
  ...baseInvoice,
  id: "inv_partial",
  invoiceNumber: "INV-0003",
  paymentType: "partial",
  total: 600,
  subTotal: 600,
  paidAmount: 200,
  remainingAmount: 400,
  status: "partial",
});
check("فاتورة بيع مدفوعة جزئيًا: رصيد العميل = المتبقي", await partyBalance("cust_1"), 1400);
check("فاتورة بيع مدفوعة جزئيًا: الصندوق +200", await cashBalance(), 1200);

// 4) مشتريات مدفوعة جزئيًا (المورد)
await insertInvoiceRows({
  ...baseInvoice,
  id: "inv_purchase",
  invoiceNumber: "PUR-0001",
  type: "purchase",
  partyId: "sup_1",
  paymentType: "partial",
  total: 500,
  subTotal: 500,
  paidAmount: 300,
  remainingAmount: 200,
  status: "partial",
});
check("مشتريات مدفوعة جزئيًا: رصيد المورد = المتبقي (دائن)", -(await partyBalance("sup_1")), 200);
check("مشتريات مدفوعة جزئيًا: الصندوق −300", await cashBalance(), 900);

// 5) سند قبض من عميل + 6) سند صرف لمورد (نفس قواعد saveVoucher)
async function insertVoucher({ id, type, partyType, partyId, amount }) {
  const isReceipt = type === "receipt";
  await db.query(
    `insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
     values ($1,'cash',$2,$3,$4,$5,'voucher',$6,'سند',$7)`,
    [id + "_cash", partyId, isReceipt ? amount : -amount, isReceipt ? amount : 0, isReceipt ? 0 : amount, id, now],
  );
  await db.query(
    `insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
     values ($1,$2,$3,$4,$5,$6,'voucher',$7,'سند',$8)`,
    [
      id + "_party",
      partyType === "customer" ? "accounts_receivable" : "accounts_payable",
      partyId,
      isReceipt ? -amount : amount,
      isReceipt ? 0 : amount,
      isReceipt ? amount : 0,
      id,
      now,
    ],
  );
}

await insertVoucher({ id: "vou_1", type: "receipt", partyType: "customer", partyId: "cust_1", amount: 400 });
check("سند قبض: رصيد العميل −400", await partyBalance("cust_1"), 1000);
check("سند قبض: الصندوق +400", await cashBalance(), 1300);

await insertVoucher({ id: "vou_2", type: "payment", partyType: "supplier", partyId: "sup_1", amount: 200 });
check("سند صرف: رصيد المورد بعد السداد", -(await partyBalance("sup_1")), 0);
check("سند صرف: الصندوق −200", await cashBalance(), 1100);

// 7) إلغاء/حذف فاتورة: حذف قيودها يعيد كل شيء
await db.query("delete from financial_transactions where reference_id = $1", ["inv_partial"]);
check("بعد حذف قيود فاتورة: رصيد العميل", await partyBalance("cust_1"), 600);
check("بعد حذف قيود فاتورة: الصندوق", await cashBalance(), 900);

// 8) هجرة الإصلاح على بيانات "قديمة" ناقصة (بدون _settle)
const legacy = {
  ...baseInvoice,
  id: "inv_legacy",
  invoiceNumber: "INV-9001",
  total: 800,
  subTotal: 800,
  paidAmount: 300,
  remainingAmount: 500,
  status: "partial",
};
await db.query(
  `insert into invoices (id, invoice_number, type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, status, is_approved, created_at)
   values ($1,$2,'sale','cust_1',$3,800,0,800,300,500,'partial','partial',true,$3)`,
  [legacy.id, legacy.invoiceNumber, now],
);
await db.query(
  `insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
   values ($1,'accounts_receivable','cust_1',800,800,0,'invoice',$2,'فاتورة مبيعات',$3),
          ($4,'cash','cust_1',300,300,0,'invoice_payment',$2,'سداد فاتورة',$3)`,
  [legacy.id + "_party", legacy.id, now, legacy.id + "_pay"],
);
const before = await partyBalance("cust_1");
const repairSql = await readFile(join(migrationsDir, "0024_invoice_balance_settlement.sql"), "utf8");
await db.exec(repairSql);
const after = await partyBalance("cust_1");
check("هجرة 0024: زيادة الرصيد القديم بالمدفوع قبل الإصلاح", before - 600, 800);
check("هجرة 0024: الرصيد بعد الإصلاح = المتبقي فقط", after - 600, 500);

const countOnce = await db.query("select count(*)::int as c from financial_transactions where id = $1", [
  legacy.id + "_settle",
]);
await db.exec(repairSql);
await db.exec(repairSql);
const countTwice = await db.query("select count(*)::int as c from financial_transactions where id = $1", [
  legacy.id + "_settle",
]);
check("هجرة 0024: صف واحد بعد التنفيذ مرة واحدة", countOnce.rows[0].c, 1);
check("هجرة 0024: لا تكرار بعد ثلاث مرات", countTwice.rows[0].c, 1);

// 9) حسابات المصروفات حسب الفئة (الخيار الثاني): كل مصروف على حساب فئته
await db.query(
  `insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
   values ('exp_rent','إيجار',150,$1,'cash','work','إيجار المعمل',$1),
          ('exp_power','كهرباء',50,$1,'cash','work','فاتورة كهرباء',$1)`,
  [now],
);
function expenseAccountBooked(expenseId) {
  return db.query("select account_id from financial_transactions where reference_id = $1 and reference_type = 'expense' and account_id <> 'cash'", [expenseId]);
}
// محاكاة saveExpense الجديد: قيد الصندوق + قيد مصروف على حساب الفئة
async function bookExpense(id, category, amount) {
  const account = `expense:${category}`;
  await db.query("insert into accounts (id, name, type) values ($1, $2, 'expense') on conflict (id) do nothing", [account, `مصروف ${category}`]);
  await db.query(
    `insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
     values ($1,'cash',$2,0,$2,'expense',$3,'مصروف',$4)`,
    [id + "_cash", amount, id, now],
  );
  await db.query(
    `insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
     values ($1,$2,$3,$3,0,'expense',$4,'مصروف',$5)`,
    [id + "_expense", account, amount, id, now],
  );
}
await bookExpense("exp_new", "صيانة", 75);

// قيد قديم نمطي: مصروف الإيجار كان يُرحَّل على «مشتريات» قبل الإصلاح
await db.query(
  `insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
   values ('exp_legacy_expense','purchases',150,150,0,'expense','exp_rent','إيجار المعمل',$1)`,
  [now],
);
const legacyAccountBefore = await expenseAccountBooked("exp_rent");
check("القيد القديم كان على «مشتريات» قبل الإصلاح", legacyAccountBefore.rows[0].account_id === "purchases" ? 1 : 0, 1);

// هجرة 0025 تنشئ حسابات الفئات وترحّل القيود القديمة (تُشغَّل أيضًا ضمن الهجرات،
// لكن هنا نضمن نتيجتها بعد إدخال البيانات القديمة)
const migration25 = await readFile(join(migrationsDir, "0025_expense_accounts_by_category.sql"), "utf8");
await db.exec(migration25);

const powerAccount = await expenseAccountBooked("exp_power");
check("مصروف كهرباء على حساب فئته (ليس مشتريات)", powerAccount.rows.length === 0 ? 1 : powerAccount.rows[0].account_id === "expense:كهرباء" ? 1 : 0, 1);
const legacyAccountAfter = await expenseAccountBooked("exp_rent");
check("هجرة 0025: القيد القديم انتقل من «مشتريات» إلى حساب الفئة", legacyAccountAfter.rows[0].account_id === "expense:إيجار" ? 1 : 0, 1);
await db.exec(migration25);
const legacyAfterTwice = await expenseAccountBooked("exp_rent");
check("هجرة 0025: آمنة للتنفيذ مرتين (لا ازدواج أو رجوع)", legacyAfterTwice.rows[0].account_id === "expense:إيجار" ? 1 : 0, 1);
const purchasesExpenseCount = await db.query(
  "select count(*)::int as c from financial_transactions where reference_type='expense' and account_id='purchases'",
);
check("لا قيد مصروف متبقٍ على «مشتريات» — حصري لفواتير الشراء", purchasesExpenseCount.rows[0].c, 0);

// محاكاة saveExpense الجديد على فئة مخصصة جديدة: الحساب يُنشأ تلقائيًا
await db.query("insert into expenses (id, category, amount, date, payment_method, type, description, created_at) values ('exp_custom','دفتر قيود',30,$1,'cash','work','دفتر قيود ورقي',$1)", [now]);
await bookExpense("exp_custom", "دفتر قيود", 30);
const customAccount = await expenseAccountBooked("exp_custom");
check("فئة مخصصة جديدة تأخذ حسابها تلقائيًا", customAccount.rows[0].account_id === "expense:دفتر قيود" ? 1 : 0, 1);

await db.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? "✅ كل الثوابت المحاسبية سليمة" : `❌ فشل ${failed.length} فحصًا`} (${results.length} فحصًا)`);
process.exit(failed.length === 0 ? 0 : 1);
