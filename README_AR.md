# حزمة إصلاح المزامنة وتكرار القيود + حسابات الموظفين

التاريخ: 2026-09-11
قاعدة البيانات: Supabase (PostgreSQL) — ليس Neon

## الملفات المشمولة (انسخها فوق نفس المسارات في المستودع)

- src/routes/settings.tsx
- src/components/app-shell.tsx
- src/server/repository.ts
- src/lib/store.ts
- src/routes/employees.tsx
- docs/SYNC_DOUBLE_CHARGE_FIX.md

## طريقة الرفع

1. فك الضغط داخل جذر المستودع (حيث يوجد package.json و src/).
2. استبدل الملفات الموجودة.
3. git add ثم commit و push.
4. بعد النشر: من Supabase → SQL Editor نفّذ سكربت التنظيف في docs/SYNC_DOUBLE_CHARGE_FIX.md إن وُجدت ذمم مكررة.

## ماذا يصلح

- منع تضاعف ذمم العملاء عند المزامنة اليدوية المتكررة
- المزامنة اليدوية/عند عودة النت تستخدم الطابور فقط
- قفل ضد تشغيل drain مرتين معًا
- زر إنشاء حساب دخول للموظف بدون حساب
