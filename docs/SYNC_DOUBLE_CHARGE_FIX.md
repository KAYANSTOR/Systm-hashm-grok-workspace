# إصلاح تكرار القيود عند المزامنة اليدوية — 2026-09-11

## الأعراض

- بعد ضغط «مزامنة بيانات هذا الجهاز الآن» مرتين: ذمة العميل تتضاعف والمبلغ يُضاف مرتين.

## السبب الجذري

1. زر المزامنة اليدوية وحدث `online` كانا يستدعيان `syncLegacyDb` → `syncLegacyData`.
2. `syncLegacyData` يعيد إدراج `financial_transactions` لكل فاتورة **بدون `ON CONFLICT`** في بعض المسارات، ثم يدرج مرة ثانية من مصفوفة `transactions` المحلية بمعرّفات مختلفة → قيدان اقتصاديان لنفس الفاتورة.
3. لا يوجد قفل يمنع تشغيل `drainPendingOutbox` مرتين بالتوازي.

## الإصلاحات المطبّقة في الكود

| ملف                            | التغيير                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `src/routes/settings.tsx`      | المزامنة اليدوية = `drainPendingOutbox` + `fetchFromDb` فقط            |
| `src/components/app-shell.tsx` | عند عودة الإنترنت: drain للطابور فقط                                   |
| `src/server/repository.ts`     | `ON CONFLICT` على قيود الفاتورة + تخطّي transactions المشتقة من فواتير |
| `src/server/repository.ts`     | `applyOutboxOperation` يضبط `claim_status='processing'` صراحة          |
| `src/lib/store.ts`             | قفل `__drainInFlight` + `forceAllowFetch()`                            |
| `src/routes/employees.tsx`     | زر «إنشاء حساب دخول» للموظفين بدون حساب                                |

## تنظيف البيانات المكررة في الإنتاج (Supabase — مرة واحدة)

قاعدة المشروع هي **Supabase (PostgreSQL)**. شغّل الاستعلامات من:

**Supabase Dashboard → SQL Editor → New query → Run**

### 1) معاينة التكرار

```sql
select reference_id, account_id, party_id, count(*), array_agg(id order by created_at) as ids
from financial_transactions
where reference_id is not null
group by reference_id, account_id, party_id
having count(*) > 1;
```

### 2) حذف المكرر (يبقي `_party` / `_pay` أو الأقدم)

```sql
with ranked as (
  select id,
         row_number() over (
           partition by reference_id, account_id, coalesce(party_id, '')
           order by
             case when id like '%\_party' escape '\' or id like '%\_pay' escape '\' then 0 else 1 end,
             created_at asc
         ) as rn
  from financial_transactions
  where reference_id is not null
)
delete from financial_transactions
where id in (select id from ranked where rn > 1);
```

### ملاحظات Supabase

- SQL Editor بحساب المالك يكفي عادة للتنفيذ.
- التطبيق يتصل عبر `DATABASE_URL` (رابط Postgres لـ Supabase / Pooler) من خادم Vercel — انظر أيضًا `migrations/0019_supabase_security_hardening.sql`.
- لا تحتاج Neon؛ أي ذكر سابق لـ Neon كان اسمًا عامًا لمسار Postgres السحابي في الكود.

بعد التنظيف: حدّث الصفحة أو اضغط المزامنة مرة واحدة (المسار الجديد الآمن).

## سلوك المزامنة بعد الإصلاح

- **خلفية:** عند حفظ عملية → outbox → drain عند الاتصال.
- **يدوي:** يرحّل الطابور فقط ثم يجلب من الخادم — لا يعيد رفع كل الفواتير.
- **idempotency:** `processed_operations.operation_id` + `claim_status` + `ON CONFLICT` على القيود.
