# ملفات معدّلة — رفع إلى GitHub

انسخ محتويات هذا الأرشيف فوق جذر المستودع:
https://github.com/KAYANSTOR/Systm-hashm-grok-workspace

## البنية
```
src/domain/          # منطق الأعمال + اختبارات
src/application/     # mutate + permissions + sync
src/server/          # repository + permissions
src/lib/             # store, types, accounting
src/routes/          # الشاشات المعدّلة
src/components/ui/   # AppSelect وغيرها
migrations/          # 0004, 0005, 0006
docs/                # تقارير التحقق
```

## أوامر مقترحة
```bash
# من جذر المستودع المحلي بعد فك الضغط
cp -r src migrations docs path/to/repo/
cd path/to/repo
git add src migrations docs
git status
git commit -m "feat: production readiness — warehouse-scoped stock, permissions, outbox integrity"
git push
```

## ملاحظات
- طبّق migrations حتى 0006_permissions_seed.sql
- اربط مستخدمي Better Auth بجدول user_roles
- الحالة: PENDING VERIFICATION (ليست Production Certified)
