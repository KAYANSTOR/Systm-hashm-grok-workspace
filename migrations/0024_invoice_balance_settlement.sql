-- 0024 — إصلاح محاسبي: قيد تسوية ذمة الطرف عن المدفوع في الفاتورة
--
-- المشكلة: عند حفظ فاتورة معتمدة كان يُكتب قيدان فقط:
--   1) _party  → ذمم مدينة/دائنة بإجمالي الفاتورة
--   2) _pay    → الصندوق بالمبلغ المدفوع
-- فلم يكن هناك قيد يقابل المدفوع على حساب الذمة نفسه، لذلك كان رصيد العميل
-- (أو المورد) — المحسوب من دفتر القيود بعد كل جلب من الخادم — يساوي إجمالي
-- الفاتورة ولا يراعي ما دُفع منها، بخلاف الرصيد المعروض لحظة الحفظ.
--
-- الإصلاح: يُضاف في الكود قيد ثالث `_settle` على حساب الذمة بالمبلغ المدفوع
-- (دائن للعميل، مدين للمورد). وهذه الهجرة تُنشئ نفس القيد للفواتير القديمة
-- المعتمدة والمدفوعة جزئيًا أو كليًا.
--
-- آمنة وقابلة لإعادة التنفيذ: `on conflict (id) do nothing` مع شرط عدم وجود
-- القيد مسبقًا، ولا تمس أي قيد آخر ولا المستندات الملغاة (is_approved = false).

insert into financial_transactions (
  id,
  account_id,
  party_id,
  amount,
  debit,
  credit,
  reference_type,
  reference_id,
  description,
  created_at
)
select
  i.id || '_settle',
  case when i.type = 'sale' then 'accounts_receivable' else 'accounts_payable' end,
  i.party_id,
  case when i.type = 'sale' then -i.paid_amount else i.paid_amount end,
  case when i.type = 'sale' then 0 else i.paid_amount end,
  case when i.type = 'sale' then i.paid_amount else 0 end,
  'invoice_payment',
  i.id,
  'سداد فاتورة',
  i.created_at
from invoices i
where i.is_approved = true
  and coalesce(i.paid_amount, 0) > 0
  and not exists (
    select 1 from financial_transactions f where f.id = i.id || '_settle'
  )
on conflict (id) do nothing;
