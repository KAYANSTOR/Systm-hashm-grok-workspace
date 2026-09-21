-- 0025 — محاسبة المصروفات: حساب مستقل لكل فئة بدل التجميع على «مشتريات»
--
-- القرار (21 سبتمبر 2026): كان كل مصروف يُرحَّل مدينًا على حساب «purchases»
-- (مشتريات) فيختلط مصروف الإيجار والكهرباء والرواتب بفواتير شراء البضاعة
-- الحقيقية، وتصبح قائمة الحسابات وتقارير المصروفات مضللة.
--
-- الإصلاح:
--   1) إنشاء حساب مصروف مستقل لكل فئة معروفة: expense:<الفئة> ← «مصروف <الفئة>».
--   2) ترحيل القيود القديمة (reference_type='expense') من «purchases» إلى
--      حساب فئته، ثم ضمان أن حساب كل فئة موجود قبل الترحيل (فئات قديمة أو
--      مخصصة غير مدرجة مسبقًا تُنشأ لفئة كل قيد على حدة).
--   3) لا حذف ولا تعديل لغير قيود المصروفات؛ «purchases» يبقى لفواتير الشراء.
-- آمنة لإعادة التنفيذ: كل خطوة بـ on conflict do nothing أو شرط عدم الترحيل.

-- 1) حسابات الفئات المعروفة
insert into accounts (id, name, type) values
('expense:إيجار',      'مصروف إيجار',      'expense'),
('expense:كهرباء',     'مصروف كهرباء',     'expense'),
('expense:رواتب',      'مصروف رواتب',      'expense'),
('expense:صيانة',      'مصروف صيانة',      'expense'),
('expense:نقل وشحن',   'مصروف نقل وشحن',   'expense'),
('expense:مستلزمات',   'مصروف مستلزمات',   'expense'),
('expense:ضيافة',      'مصروف ضيافة',      'expense'),
('expense:أخرى',       'مصروف أخرى',       'expense')
on conflict (id) do nothing;

-- 2) حساب لكل فئة مستخدمة في جدول المصروفات وغير مدرجة أعلاه (فئات مخصصة)
insert into accounts (id, name, type)
select distinct 'expense:' || e.category, 'مصروف ' || e.category, 'expense'
from expenses e
where e.category is not null and e.category <> ''
on conflict (id) do nothing;

-- 3) ترحيل قيود المصروفات القديمة من «مشتريات» إلى حساب الفئة الصحيح
update financial_transactions ft
set account_id = 'expense:' || e.category
from expenses e
where ft.reference_type = 'expense'
  and ft.reference_id = e.id
  and ft.account_id = 'purchases'
  and e.category is not null and e.category <> ''
  and exists (select 1 from accounts a where a.id = 'expense:' || e.category);
