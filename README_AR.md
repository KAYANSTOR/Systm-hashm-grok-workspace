# حزمة التعديلات المجمّعة (3 جولات)

التاريخ: 2026-09-11
قاعدة البيانات: Supabase

## الجولة 1 — المزامنة وتكرار القيود

- منع تضاعف ذمم العملاء عند المزامنة اليدوية المتكررة
- المزامنة اليدوية/عند عودة النت تستخدم الطابور (Outbox) فقط
- قفل ضد تشغيل drain مرتين معًا
- ON CONFLICT على القيود المالية

## الجولة 2 — الموظفون والأدوار والصلاحيات

- إصلاح Unauthorized عند إضافة موظف (إنشاء حساب مباشر بدون signUpEmail)
- عرض كل الموظفين من قاعدة البيانات
- تعديل / أرشفة / استعادة / حذف
- إنشاء حساب دخول للموظفين بدون حساب
- شاشة أدوار وصلاحيات مجمّعة حسب الشاشات والإجراءات

## الجولة 3 — الإعدادات وتصفية القاعدة

- زر حذف/تصفية قاعدة البيانات يعمل فعليًا على الخادم + مسح محلي للطابور
- تأكيد مزدوج: كتابة «حذف الكل» ثم تأكيد نهائي
- تنسيق شاشة الإعدادات متجاوب للهاتف والكمبيوتر

## الملفات المشمولة

- src/routes/settings.tsx
- src/routes/employees.tsx
- src/routes/settings.access-control.tsx
- src/components/app-shell.tsx
- src/components/settings/access-control-card.tsx
- src/server/repository.ts
- src/server/employees.ts
- src/lib/store.ts
- docs/SYNC_DOUBLE_CHARGE_FIX.md

## طريقة الرفع

1. فك الضغط داخل جذر المستودع (حيث package.json و src/)
2. استبدال الملفات
3. git add ثم commit ثم push
4. إن وُجدت ذمم مكررة قديمة: نفّذ سكربت التنظيف في docs/SYNC_DOUBLE_CHARGE_FIX.md من SQL Editor في Supabase
