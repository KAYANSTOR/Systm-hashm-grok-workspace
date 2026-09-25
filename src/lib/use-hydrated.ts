import { useEffect, useState } from "react";

/**
 * هل اكتمل ترطيب العميل؟
 * ----------------------
 * بعض قيم المتجر تُبنى على العميل من واجهات المتصفح (`navigator.onLine`) أو
 * تُقرأ من التخزين المحلي، فلا وجود لها على الخادم. رسمها مباشرةً أثناء الرسم
 * الأول يجعل HTML الخادم يخالف رسم العميل فيفشل ترطيب React ويُعاد بناء الشجرة
 * كاملة (خلل ظهر فعليًا في شاشة الإعدادات).
 *
 * الاستخدام: اعرض قيمة محايدة حتى يصبح `hydrated` صحيحًا:
 *   const hydrated = useHydrated();
 *   const state = hydrated ? connectionState : "unknown";
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
