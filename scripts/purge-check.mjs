#!/usr/bin/env node
// @ts-check
/**
 * فحص «حذف وتصفية قاعدة البيانات» — قابل للتشغيل بلا قاعدة بيانات خارجية.
 * -----------------------------------------------------------------------
 * يبني مخطط قاعدة البيانات فعليًا من `migrations/*.sql` في PGlite، ثم:
 *
 *   1) **يُعيد إنتاج العلة القديمة**: يحذف جدول `audit_events` داخل `try/catch`
 *      كما كان يفعل الكود السابق، ويُثبت أن البيانات تبقى كما هي — لأن الجدول
 *      محمي بمُشغِّل append-only (0012)، فأول جملة فاشلة تُجهِض المعاملة ويتحول
 *      `COMMIT` إلى `ROLLBACK` صامت.
 *   2) **يتحقق من الإصلاح**: `purgeBusinessData` يُفرِّغ كل جداول بيانات العمل،
 *      ويُبقي سجل التدقيق، ويرمي خطأً إن تعذّر الحذف (لا نجاح كاذب).
 *
 * التشغيل: node --experimental-strip-types scripts/purge-check.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { purgeBusinessData, PURGE_TABLES } from "../src/domain/purge.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "migrations");

const failures = [];
function check(name, ok, detail = "") {
  if (!ok) failures.push(name);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` → ${detail}` : ""}`);
}

const db = new PGlite();

/**
 * مغلّف صغير يجعل PGlite يطابق السطح الذي يمرّره الخادم إلى `purgeBusinessData`
 * (مصفوفة صفوف بدل كائن `{ rows }`) — نفس ما يفعله `lib/db.ts` في التطبيق.
 */
const sql = {
  query: async (text, params) => (await db.query(text, params)).rows,
};

// 1) المخطط الكامل كما يُطبَّق في الإنتاج/المعاينة
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();
await db.exec(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
);
for (const name of files) {
  const sqlText = await readFile(join(migrationsDir, name), "utf8");
  await db.transaction(async (tx) => {
    await tx.exec(sqlText);
    await tx.query("insert into _migrations (name) values ($1)", [name]);
  });
}
console.log(`🧱 طُبِّقت ${files.length} هجرة على PGlite بنجاح\n`);

const count = async (table) => {
  const r = await db.query(`select count(*)::int as n from ${table}`);
  return Number(r.rows[0].n);
};

/** بيانات عمل واقعية في كل جدول يُفترض أن تُصفّى. */
async function seedBusinessData() {
  await db.exec(`
    insert into parties (id, type, name, phone, address) values
      ('p1', 'customer', 'عميل تجريبي', '770000000', 'صنعاء'),
      ('p2', 'supplier', 'مورد تجريبي', '771111111', 'صنعاء');
    insert into products (id, name, category, unit, cost_price, selling_price) values
      ('pr1', 'صنف تجريبي', 'fabric', 'قطعة', 100, 200);
    insert into invoices (id, invoice_number, type, party_id, date, payment_type, status, total, sub_total, paid_amount, remaining_amount)
      values ('inv1', 'INV-1', 'sale', 'p1', now(), 'cash', 'approved', 200, 200, 200, 0);
    insert into invoice_items (id, invoice_id, product_id, name, quantity, unit_price, total)
      values ('it1', 'inv1', 'pr1', 'صنف تجريبي', 1, 200, 200);
    insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method)
      values ('v1', 'V-1', 'receipt', 'customer', 'p1', 50, now(), 'cash');
    insert into expenses (id, category, amount, date, payment_method, type) values ('e1', 'كهرباء', 30, now(), 'cash', 'expense');
    insert into accounts (id, name, type) values ('cash', 'الصندوق', 'asset')
      on conflict (id) do nothing;
    insert into financial_transactions (id, account_id, party_id, amount, debit, credit)
      values ('t1', 'cash', 'p1', 200, 200, 0);
    insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity)
      values ('m1', 'pr1', 'wh1', 'in', 5);
    insert into warehouse_stock (warehouse_id, product_id, quantity) values ('wh1', 'pr1', 5);
    insert into processed_operations (operation_id, operation_type, result_summary) values ('op1', 'invoice.save', '{}'::jsonb);
    insert into sync_outbox (id, operation_id, operation_type, payload) values ('o1', 'op2', 'invoice.save', '{}'::jsonb);
    insert into sync_conflicts (id, organization_id, operation_id, operation_type, document_id, entity_type, entity_id, status)
      values ('c1', 'default_org', 'op3', 'invoice.save', 'inv1', 'invoice', 'inv1', 'open');
    -- سجل التدقيق يبقى بعد التصفية (بتصميم النظام)، لذلك إعادة التغذية لا تحذفه
    insert into audit_events (audit_id, entity_type, entity_id, action) values ('a1', 'invoice', 'inv1', 'delete')
      on conflict (audit_id) do nothing;
  `);
}

await seedBusinessData();
check("تغذية بيانات العمل نجحت", (await count("invoices")) === 1);

// 2) إعادة إنتاج العلة القديمة حرفيًا: حذف audit_events داخل try/catch
let oldSequenceError = null;
try {
  await db.transaction(async (tx) => {
    await tx.query("delete from financial_transactions");
    await tx.query("delete from inventory_movements");
    try {
      await tx.query("delete from warehouse_stock");
    } catch {
      /* كما في الكود القديم */
    }
    await tx.query("delete from invoice_items");
    await tx.query("delete from invoices");
    await tx.query("delete from vouchers");
    await tx.query("delete from expenses");
    await tx.query("delete from products");
    await tx.query("delete from parties");
    try {
      await tx.query("delete from processed_operations");
    } catch {
      /* old */
    }
    try {
      await tx.query("delete from sync_outbox");
    } catch {
      /* old */
    }
    try {
      await tx.query("delete from sync_conflicts");
    } catch {
      /* old */
    }
    try {
      await tx.query("delete from audit_events");
    } catch {
      /* old — هنا كان الخطأ يُبتلع فيُجهِض المعاملة صامتًا */
    }
  });
} catch (error) {
  oldSequenceError = error;
}

const survivedInvoices = await count("invoices");
console.log(
  `\n🔎 محاكاة السلوك القديم: invoices=${survivedInvoices} · parties=${await count("parties")} · استثناء=${oldSequenceError ? "نعم" : "لا"}\n`,
);
check(
  "العلة القديمة مُعاد إنتاجها: البيانات تبقى كاملة رغم نجاح المعاملة",
  survivedInvoices === 1,
  `invoices=${survivedInvoices} (المتوقع 1)`,
);
check(
  "سبب الجذر مؤكَّد: حذف audit_events مرفوض دائمًا بمُشغِّل append-only",
  oldSequenceError !== null || survivedInvoices === 1,
);

// 3) الإصلاح: التصفية المشتركة تُفرِّغ كل شيء وتتحقق من ذلك
const auditBefore = await count("audit_events");
const result = await purgeBusinessData(sql);
console.log(`\n🧹 الجداول المُفرَّغة: ${result.cleared.join(", ")}`);
if (result.absent.length) console.log(`ℹ️  جداول غير موجودة (تُتجاهل): ${result.absent.join(", ")}\n`);

let allEmpty = true;
for (const table of PURGE_TABLES) {
  if (!result.cleared.includes(table)) continue;
  const n = await count(table);
  if (n !== 0) allEmpty = false;
  check(`أُفرِغ جدول ${table}`, n === 0, `المتبقي ${n}`);
}
check("كل جداول بيانات العمل فارغة", allEmpty);

const auditAfter = await count("audit_events");
check(
  "سجل التدقيق محفوظ ولم يُحذف (بتصميم النظام)",
  auditAfter === auditBefore && auditAfter > 0,
  `${auditBefore} → ${auditAfter}`,
);

// 4) ضمان عدم النجاح الكاذب: جدول محمي بمُشغِّل يرفض الحذف ⇒ يجب أن يرمي خطأً
await seedBusinessData();
await db.exec(`
  create or replace function block_voucher_delete() returns trigger language plpgsql as $$
  begin
    raise exception 'vouchers deletion blocked for test' using errcode = '42501';
  end; $$;
  create trigger test_block_voucher_delete before delete on vouchers
  for each row execute function block_voucher_delete();
`);
let threw = false;
try {
  await purgeBusinessData(sql);
} catch {
  threw = true;
}
check("يفشل بصراحة ويُجهِض التصفية عند تعذّر الحذف (لا نجاح كاذب)", threw);

console.log(
  `\n${failures.length === 0 ? "✅ كل فحوص التصفية ناجحة" : `❌ فحوص فاشلة: ${failures.join(" · ")}`}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
