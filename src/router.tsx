import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    /**
     * سرعة التنقل بين الشاشات (هدف: فوري بلا وميض هيكل تحميل):
     *  - preload intent + delay 0: جلب ملف الشاشة لحظة اللمس/المرور.
     *  - preloadStaleTime طويل: العودة لشاشة سابقة فورية بدون إعادة جلب.
     *  - pendingMs/MinMs = 0: لا ننتظر ولا نفرض حد أدنى لمؤشر الانتظار؛
     *    الشاشات المُسخَّنة تظهر فورًا بلا skeleton.
     */
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 120_000,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    scrollRestoration: true,
  });
}
