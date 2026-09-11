import { Suspense, useCallback, useMemo, type ReactNode } from "react";
import { useState, useEffect } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Boxes,
  Calculator,
  CreditCard,
  Home,
  PieChart,
  Receipt,
  Settings,
  UserPlus,
  Users,
  Wallet,
  X,
  Wifi,
  WifiOff
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/sales", label: "المبيعات", icon: Calculator },
  { to: "/inventory", label: "المخزن", icon: Boxes },
  { to: "/vouchers", label: "السندات", icon: Receipt },
  { to: "/cashbox", label: "الصندوق", icon: Wallet },
  { to: "/expenses", label: "المصروفات", icon: CreditCard },
  { to: "/reports", label: "التقارير", icon: PieChart },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

const MOBILE_NAV = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/cashbox", label: "الصندوق", icon: Wallet },
  { to: "/reports", label: "التقارير", icon: PieChart },
  { to: "/inventory", label: "المخزن", icon: Boxes },
] as const;

const QUICK = [
  { to: "/sales", label: "فاتورة جديدة", icon: Calculator, tone: "bg-brand-soft text-brand" },
  { to: "/vouchers", label: "سند جديد", icon: Receipt, tone: "bg-good-soft text-good" },
  { to: "/parties", label: "إضافة جهة", icon: UserPlus, tone: "bg-accent-soft text-accent" },
  { to: "/expenses", label: "مصروف جديد", icon: CreditCard, tone: "bg-bad-soft text-bad" },
] as const;


function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      toast.info("تمت استعادة الاتصال، جارٍ ترحيل العمليات المحفوظة إلى السحابة…", { duration: 5000 });
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

function PageSkeleton() {
  return (
    <div className="space-y-5" aria-label="جاري تحميل الشاشة" role="status">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-paper/80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-3xl bg-paper/80" />
        <div className="h-28 animate-pulse rounded-3xl bg-paper/80" />
        <div className="h-28 animate-pulse rounded-3xl bg-paper/80" />
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-paper/80" />
    </div>
  );
}


export function AppShell({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inventory = useStore((s) => s.inventory);
  const settings = useStore((s) => s.settings);
  const organizationLogo = useStore((s) => s.organization.logo);
  const connectionState = useStore((s) => s.connectionState);
  const pendingSyncCount = useStore((s) => s.pendingSyncCount);
  const lastSyncMessage = useStore((s) => s.lastSyncMessage);
  const drainPendingOutbox = useStore((s) => s.drainPendingOutbox);

  useEffect(() => {
    const logo = organizationLogo || "/icons/icon-192.png";
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
      link.href = logo;
    });
  }, [organizationLogo]);

  const [fabOpen, setFabOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const [isHydrated, setIsHydrated] = useState(false);

  const preload = useCallback((to: string) => {
    void router.preloadRoute({ to } as never);
  }, [router]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setFabOpen(false);
    setNotesOpen(false);
  }, [pathname]);

  useEffect(() => {
    // عند عودة الإنترنت: رحّل طابور العمليات فقط — لا تعيد رفع لقطة كاملة (كانت تسبب تكرار القيود).
    const retrySync = () => { void drainPendingOutbox().catch(() => undefined); };
    window.addEventListener("online", retrySync);
    return () => window.removeEventListener("online", retrySync);
  }, [drainPendingOutbox]);

  useEffect(() => {
    if (lastSyncMessage === "تم ترحيل البيانات إلى السحابة بنجاح") {
      toast.success(lastSyncMessage, { duration: 5000 });
    }
  }, [lastSyncMessage]);

  const lowStock = useMemo(
    () => inventory.filter((i) => i.quantity <= (i.minQuantity || 0)),
    [inventory],
  );

  if (!isHydrated) {
    return (
      <div className="min-h-dvh bg-canvas text-ink flex items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="mt-4 text-sm font-bold text-muted">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Toaster richColors position="top-center" dir="rtl" />

      <div className="flex min-h-dvh w-full">
        <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-line bg-paper p-4 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-2">
            <img src={organizationLogo || "/icons/icon-192.png"} alt="شعار معمل هاشم" className="size-11 rounded-2xl object-contain shadow-sm" />
            <div>
              <p className="text-sm font-black leading-tight text-brand">معمل هاشم</p>
              <p className="text-[11px] font-medium text-muted">إدارة المعمل</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  onPointerEnter={() => preload(item.to)}
                  onTouchStart={() => preload(item.to)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
                    "touch-manipulation",
                    "will-change-auto",
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 bg-canvas/90 px-4 backdrop-blur-md lg:px-6">
            <div className="flex items-center gap-2">
              {pathname !== "/" ? (
                <Link to="/" className="btn-icon" aria-label="رجوع">
                  <ArrowRight className="size-5" />
                </Link>
              ) : null}
              <Link to="/settings" className="btn-icon" aria-label="الإعدادات">
                <Settings className="size-5" />
              </Link>
              <div className="relative">
                <button
                  type="button"
                  className="btn-icon relative"
                  onClick={() => setNotesOpen((v) => !v)}
                  aria-label="التنبيهات"
                >
                  <Bell className="size-5" />
                  {lowStock.length > 0 ? (
                    <span className="absolute -top-1 -left-1 flex size-4 items-center justify-center rounded-full bg-bad text-[10px] font-black text-brand-fg">
                      {lowStock.length}
                    </span>
                  ) : null}
                </button>
                <AnimatePresence>
                  {notesOpen && (
                    <>
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        type="button"
                        className="fixed inset-0 z-30 cursor-default"
                        aria-label="إغلاق التنبيهات"
                        onClick={() => setNotesOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-12 z-40 w-72 origin-top-right overflow-hidden rounded-2xl border border-line bg-paper shadow-xl"
                      >
                        <div className="border-b border-line bg-canvas px-3 py-2">
                          <p className="text-sm font-black">تنبيهات المخزن</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {lowStock.length === 0 ? (
                            <p className="p-4 text-center text-sm text-muted">لا توجد تنبيهات</p>
                          ) : (
                            lowStock.map((item) => (
                              <Link
                                key={item.id}
                                to="/inventory"
                                className="block border-b border-line px-3 py-2.5 text-right last:border-0 hover:bg-canvas"
                              >
                                <p className="text-sm font-bold">{item.name}</p>
                                <p className="text-xs text-bad">المتبقي: {item.quantity}</p>
                              </Link>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex items-center gap-2 text-left">
              <div className="hidden sm:block">
                <p className="text-sm font-black leading-tight text-brand">
                  {settings.name.split(" ")[0]} هاشم
                </p>
                <p className="text-[11px] text-muted">صنعاء</p>
              </div>

              <div className="flex items-center">
                {isOnline ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-1 text-[10px] font-bold text-good" title="متصل بالإنترنت">
                    <Wifi className="size-3" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-bad/10 px-2 py-1 text-[10px] font-bold text-bad" title="وضع عدم الاتصال">
                    <WifiOff className="size-3" />
                    <span className="hidden sm:inline">غير متصل</span>
                  </div>
                )}
              </div>

              <img src={organizationLogo || "/icons/icon-192.png"} alt="شعار معمل هاشم" className="size-10 rounded-2xl object-contain shadow-sm" />
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-2 lg:px-8 lg:pb-10 relative overflow-x-hidden">
            {connectionState === "offline" ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-bad/10 px-4 py-2.5 text-xs font-bold text-bad" role="status">
                <span>غير متصل — البيانات تُحفظ على الجهاز</span>
              </div>
            ) : pendingSyncCount > 0 ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn/10 px-4 py-2.5 text-xs font-bold text-warn" role="status">
                <span>جارٍ مزامنة {pendingSyncCount} عملية مع السحابة…</span>
                <button
                  type="button"
                  className="rounded-lg border border-warn/40 px-2 py-1 text-[11px] hover:bg-warn/10"
                  onClick={() => {
                    try {
                      useStore.getState().clearStuckOutbox?.();
                      void useStore.getState().drainPendingOutbox();
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  إعادة المحاولة / تنظيف
                </button>
              </div>
            ) : null}
            <div key={pathname} className="w-full">
              <Suspense fallback={<PageSkeleton />}>
                {children}
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="no-print fixed inset-0 z-40 bg-ink/20 lg:hidden"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, type: "spring", bounce: 0 }}
            className="no-print fixed bottom-24 left-1/2 z-50 flex w-52 -translate-x-1/2 flex-col gap-2 lg:hidden"
          >
            {QUICK.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3 shadow-lg"
                >
                  <span className="text-sm font-bold">{q.label}</span>
                  <span className={cn("rounded-xl p-2", q.tone)}>
                    <Icon className="size-5" />
                  </span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(20,50,58,0.06)] lg:hidden">
        <div className="relative mx-auto flex h-20 max-w-lg items-center justify-around px-2">
          <button
            type="button"
            className={cn(
              "absolute -top-7 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-canvas text-brand-fg shadow-lg transition",
              fabOpen ? "rotate-45 bg-brand-dark" : "bg-brand",
            )}
            onClick={() => setFabOpen((v) => !v)}
            aria-label={fabOpen ? "إغلاق الإجراءات" : "إجراءات سريعة"}
          >
            {fabOpen ? <X className="size-7" /> : <ArrowUp className="size-7 stroke-[3]" />}
          </button>
          {MOBILE_NAV.map((item, i) => {
            const Icon = item.icon;
            const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  onPointerEnter={() => preload(item.to)}
                  onTouchStart={() => preload(item.to)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 pt-1 text-[11px] font-bold",
                  i === 1 && "ml-8",
                  i === 2 && "mr-8",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
