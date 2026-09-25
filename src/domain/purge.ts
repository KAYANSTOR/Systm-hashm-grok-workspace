/**
 * تصفية بيانات العمل — منطق واحد يُستخدم من الخادم ومن الفحص الآلي.
 * -----------------------------------------------------------------
 * **العلة التي أُصلحت (25 سبتمبر 2026):** كانت دالة التصفية في `server/repository.ts`
 * تحذف جداول اختيارية داخل `try/catch` — ومنها `delete from audit_events`. وهذا الجدول
 * محمي بمُشغِّل `audit_events_append_only` (الهجرة 0012) يرفض أي حذف **دائمًا**.
 *
 * في PostgreSQL، أول جملة تفشل داخل معاملة تُدخلها في حالة "aborted": كل الجمل التالية
 * تُتجاهل، و`COMMIT` على معاملة مُجهَضة يتحول إلى `ROLLBACK` **ويُبلِّغ عن النجاح**. لذلك
 * كانت الشاشة تعرض «تم الحذف والتصفية بنجاح» بينما **لم يُحذف أي صف** — ولأن الواجهة
 * تعيد قراءة البيانات من الخادم بعد التصفية، ظهر وكأن بيانات الجهاز أيضًا لم تُحذف.
 *
 * القواعد الملزمة هنا:
 *   1. لا `try/catch` حول أي حذف — الفشل يجب أن يُسقط المعاملة بالكامل لا أن يمرّ صامتًا.
 *   2. وجود الجداول يُفحص **قبل** الحذف (استعلام ناجح)، لا بمحاولة حذف تفشل.
 *   3. بعد الحذف **نتحقق** أن الجداول فارغة فعلًا؛ إن بقي أي صف نرمي خطأ.
 *   4. `audit_events` **لا يُحذف أبدًا** بتصميم النظام: سجل غير قابل للتعديل، وهو الدليل
 *      على أن التصفية حدثت ومن نفّذها.
 */

/** الجداول التي تُصفّى، بترتيب يحترم المفاتيح الأجنبية. */
export const PURGE_TABLES = [
  "financial_transactions",
  "inventory_movements",
  "warehouse_stock",
  "invoice_items",
  "invoices",
  "vouchers",
  "expenses",
  "products",
  "parties",
  "processed_operations",
  "sync_outbox",
  "sync_conflicts",
] as const;

/**
 * جداول لا تُصفّى أبدًا رغم أنها تحمل حركة:
 *   - `audit_events`: محمي بمُشغِّل append-only (0012) — وهو سجل التصفية نفسه.
 *   - `employees` / `users` / `roles` / `permissions` / `user_roles` / `accounts`:
 *     حسابات الدخول والصلاحيات لا تُمس (قرار صاحب المشروع).
 *   - `organization_profile` / `warehouses` / `product_categories`: إعدادات لا حركة.
 */
export const PURGE_PRESERVED_TABLES = ["audit_events"] as const;

/**
 * السطح الأدنى من واجهة SQL الذي نحتاجه — متوافق مع `Sql` في `lib/db.ts` ومع
 * المعاملة (`tx`) التي يمرّرها `sql.transaction`. نستخدم `query` فقط لأن أسماء
 * الجداول معرّفات لا تُمرَّر كوسائط، مع أن هذا يبقي الوحدة قابلة للفحص مع PGlite
 * مباشرةً عبر مغلّف صغير.
 */
export interface PurgeSql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface PurgeResult {
  /** جداول حُذفت فعليًا وتأكّد أنها فارغة. */
  cleared: string[];
  /** جداول متوقّعة لكنها غير موجودة في هذه القاعدة (بيئات قديمة) — تُتجاهل بأمان. */
  absent: string[];
}

/** أسماء الجداول الموجودة في المخطط الحالي. */
async function existingTables(sql: PurgeSql): Promise<Set<string>> {
  const rows = await sql.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = current_schema()",
  );
  return new Set(rows.map((row) => row.table_name));
}

/**
 * يحذف كل بيانات العمل ثم **يتأكد** أنها فُرِّغت. يرمي خطأً عند أي فشل، فلا يمكن أن
 * تُعلن الواجهة نجاحًا كاذبًا مرة أخرى.
 */
export async function purgeBusinessData(sql: PurgeSql): Promise<PurgeResult> {
  const present = await existingTables(sql);
  const cleared: string[] = [];
  const absent: string[] = [];

  for (const table of PURGE_TABLES) {
    if (!present.has(table)) {
      absent.push(table);
      continue;
    }
    // أسماء الجداول من ثابت داخلي فقط — لا مُدخل مستخدم، لذلك لا خطر في تركيب النص.
    await sql.query(`delete from ${table}`);
    cleared.push(table);
  }

  const leftovers: string[] = [];
  for (const table of cleared) {
    const rows = await sql.query<{ n: number }>(`select count(*)::int as n from ${table}`);
    const remaining = Number(rows[0]?.n ?? 0);
    if (remaining > 0) leftovers.push(`${table} (${remaining})`);
  }
  if (leftovers.length) {
    throw new Error(
      `تعذّر إتمام تصفية قاعدة البيانات — بقي بيانات في: ${leftovers.join(", ")}. لم يُحذف شيء (المعاملة أُلغيت).`,
    );
  }

  return { cleared, absent };
}
