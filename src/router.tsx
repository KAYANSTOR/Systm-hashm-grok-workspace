import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    /**
     * سرعة التنقل بين الشاشات:
     *  - `defaultPreload: "intent"` يجلب ملف الشاشة لحظة لمس/مرور المؤشر على الرابط.
     *  - `defaultPreloadDelay: 0` بلا تأخير (الافتراضي 50ms يترك فجوة محسوسة).
     *  - `defaultPreloadStaleTime` يمنع إعادة الجلب المتكرر عند التنقل ذهابًا وإيابًا،
     *    فتكون العودة إلى شاشة سبق فتحها فورية.
     *  - مؤشرات الانتظار أقصر (`defaultPendingMs`) فلا يومض هيكل التحميل بلا داع.
     */
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 180,
    defaultPendingMinMs: 120,
    scrollRestoration: true,
  });
}
