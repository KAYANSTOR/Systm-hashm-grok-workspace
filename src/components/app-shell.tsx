import { Suspense, useMemo, useState, useEffect, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Bell,
  Boxes,
  Calculator,
  CreditCard,
  Home,
  PieChart,
  Receipt,
  RefreshCw,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { canAccessPath, filterNavByPermissions, firstAllowedPath } from "@/lib/access";
import { ACCESS_CONTROL, AUTH_REQUIRED, PRODUCT_SALES } from "@/lib/features";

// اسم شاشة /sales يتبع المفتاح: «المبيعات» عند إظهار فواتير البضاعة،
// و«خدمات التطريز» عندما تكون الواجهة مخصّصة لخدمات التطريز فقط.
type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<NavItem> }> = [
  {
    label: "الرئيسية",
    items: [{ to: "/", label: "لوحة المعمل", icon: Home }],
  },
  {
    label: "العمليات",
    items: [
      { to: "/sales", label: PRODUCT_SALES ? "المبيعات" : "خدمات التطريز", icon: Calculator },
      { to: "/vouchers", label: "السندات", icon: Receipt },
      { to: "/inventory", label: "المخزن", icon: Boxes },
    ],
  },
  {
    label: "المالية",
    items: [
      { to: "/cashbox", label: "الصندوق", icon: Wallet },
      { to: "/expenses", label: "المصروفات", icon: CreditCard },
      { to: "/parties", label: "العملاء والموردون", icon: Users },
      { to: "/reports", label: "التقارير", icon: PieChart },
    ],
  },
  {
    label: "النظام",
    items: [{ to: "/settings", label: "الإعدادات", icon: Settings }],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

// لا نعتمد على preloadRoute وحده؛ بعض بيئات الإنتاج تؤجل lazy route modules
// حتى لحظة التنقل. تحميلها صراحة عند الدخول الأول يجعل كل الشاشات جاهزة
// للعمل دون إنترنت أو انتظار شبكة عند أول نقرة.
const SCREEN_MODULES = [
  () => import("../routes/index.lazy"),
  () => import("../routes/sales.lazy"),
  () => import("../routes/vouchers.lazy"),
  () => import("../routes/inventory.lazy"),
  () => import("../routes/cashbox.lazy"),
  () => import("../routes/expenses.lazy"),
  () => import("../routes/parties.lazy"),
  () => import("../routes/reports.lazy"),
] as const;

const MOBILE_NAV = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/cashbox", label: "الصندوق", icon: Wallet },
  { to: "/reports", label: "التقارير", icon: PieChart },
  { to: "/inventory", label: "المخزن", icon: Boxes },
] as const;

const QUICK = [
  {
    to: "/sales",
    label: PRODUCT_SALES ? "فاتورة جديدة" : "فاتورة خدمة تطريز",
    icon: Calculator,
    tone: "bg-brand-soft text-brand",
  },
  { to: "/vouchers", label: "سند جديد", icon: Receipt, tone: "bg-good-soft text-good" },
  { to: "/parties", label: "إضافة جهة", icon: UserPlus, tone: "bg-accent-soft text-accent" },
  { to: "/expenses", label: "مصروف جديد", icon: CreditCard, tone: "bg-bad-soft text-bad" },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "لوحة المعمل",
  "/sales": PRODUCT_SALES ? "المبيعات" : "خدمات التطريز",
  "/vouchers": "السندات",
  "/inventory": "المخزن",
  "/cashbox": "الصندوق",
  "/expenses": "المصروفات",
  "/parties": "العملاء والموردون",
  "/reports": "التقارير",
  "/settings": "الإعدادات",
  "/employees": "الموظفون",
};

function useOnlineStatus() {
  // نبدأ دائمًا بـ true ثم نقرأ `navigator.onLine` بعد التركيب في `useEffect`:
  // قراءتها أثناء الرسم تجعل HTML الخادم يخالف رسم العميل الأول فيفشل ترطيب React.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      toast.info("تمت استعادة الاتصال، جارٍ ترحيل العمليات المحفوظة إلى السحابة…", {
        duration: 5000,
      });
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

function PageSkeleton() {
  return (
    <div className="space-y-5" aria-label="جاري تحميل الشاشة" role="status">
      <div className="h-12 w-64 animate-pulse rounded-2xl bg-paper/80" />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <div className="h-24 animate-pulse rounded-3xl bg-paper/80" />
        <div className="h-24 animate-pulse rounded-3xl bg-paper/80" />
        <div className="h-24 animate-pulse rounded-3xl bg-paper/80" />
        <div className="h-24 animate-pulse rounded-3xl bg-paper/80" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-paper/80" />
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
  const userPermissions = useStore((s) => s.userPermissions || []);
  const permissionsLoaded = useStore((s) => s.permissionsLoaded);

  // لا نحجب المسار أو البطاقة قبل وصول الصلاحيات من الخادم؛ الحماية الفعلية تبقى على الخادم.
  // بعد اكتمال الجلب تُصفّى القوائم ويُمنع الوصول المباشر للمسارات غير المسموحة.
  //
  // الأدوار والصلاحيات موقوفة مؤقتًا (FEATURES.ACCESS_CONTROL = false): تظهر كل
  // الشاشات بلا تصفية ولا حجب، مع بقاء كامل منطق الصلاحيات في `lib/access.ts`
  // جاهزًا لإعادة التفعيل بإرجاع المفتاح إلى true.
  const permissionsEnforced = ACCESS_CONTROL && permissionsLoaded;
  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: permissionsEnforced
          ? filterNavByPermissions(group.items, userPermissions)
          : group.items,
      })).filter((group) => group.items.length > 0),
    [permissionsEnforced, userPermissions],
  );
  const navItems = useMemo(
    () => (permissionsEnforced ? filterNavByPermissions(ALL_NAV, userPermissions) : ALL_NAV),
    [permissionsEnforced, userPermissions],
  );
  const mobileNavItems = useMemo(
    () => (permissionsEnforced ? filterNavByPermissions(MOBILE_NAV, userPermissions) : MOBILE_NAV),
    [permissionsEnforced, userPermissions],
  );
  const quickItems = useMemo(
    () => (permissionsEnforced ? filterNavByPermissions(QUICK, userPermissions) : QUICK),
    [permissionsEnforced, userPermissions],
  );
  const pathAllowed = useMemo(
    () => !permissionsEnforced || canAccessPath(pathname, userPermissions),
    [pathname, permissionsEnforced, userPermissions],
  );
  const canOpenSettings = useMemo(
    () => !permissionsEnforced || canAccessPath("/settings", userPermissions),
    [permissionsEnforced, userPermissions],
  );
  const firstAllowed = useMemo(
    () => (permissionsEnforced ? firstAllowedPath(userPermissions) : null),
    [permissionsEnforced, userPermissions],
  );

  useEffect(() => {
    const logo = organizationLogo || "/icons/icon-192.png";
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => {
        link.href = logo;
      });
  }, [organizationLogo]);

  const [fabOpen, setFabOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  /**
   * حالة الاتصال كما تُعرض: قبل اكتمال التركيب لا نعرض الحالة الحقيقية لأن المتجر
   * يبنيها من `navigator.onLine` على العميل بينما الخادم لا يعرفه — واختلافهما كان
   * يسبب خطأ ترطيب في كل الشاشات. نعرض «غير معروف» بدلًا منه حتى ينتهي التركيب.
   */
  const cloudState: "unknown" | "offline" | "online" | "syncing" = isHydrated
    ? connectionState
    : "unknown";

  useEffect(() => {
    if (
      !isHydrated ||
      !permissionsEnforced ||
      pathname !== "/" ||
      canAccessPath("/", userPermissions)
    )
      return;
    if (firstAllowed) void router.navigate({ to: firstAllowed as never });
  }, [firstAllowed, isHydrated, permissionsEnforced, pathname, router, userPermissions]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  /**
   * تحميل كود كل الشاشات بعد أول رسم مباشرة حتى لا تنتظر أول نقرة الشبكة.
   * البيانات نفسها محفوظة في Zustand persist، لذلك بعد الدخول الأول تعمل
   * الشاشات من الذاكرة/التخزين المحلي حتى عند انقطاع الإنترنت.
   */
  useEffect(() => {
    // حمّل المسارات التي تظهر في شريط الجوال أولًا، ثم أكمل الباقي في وقت
    // خامل حتى لا تنافس المزامنة أو أول نقرة على موارد الهاتف.
    const priority = new Set(["/", "/cashbox", "/reports", "/inventory"]);
    const targets = Array.from(new Set([
      ...navItems.map((item) => item.to),
      ...mobileNavItems.map((item) => item.to),
      ...quickItems.map((item) => item.to),
    ]));
    const warmPriority = () => {
      void Promise.all([SCREEN_MODULES[0](), SCREEN_MODULES[4](), SCREEN_MODULES[7](), SCREEN_MODULES[3]()]).catch(() => undefined);
      for (const to of targets.filter((path) => priority.has(path))) {
        void router.preloadRoute({ to } as never).catch(() => undefined);
      }
    };
    const warmRemaining = () => {
      void Promise.all(SCREEN_MODULES.map((load) => load())).catch(() => undefined);
      for (const to of targets.filter((path) => !priority.has(path))) {
        void router.preloadRoute({ to } as never).catch(() => undefined);
      }
    };
    warmPriority();
    const timer = window.setTimeout(warmRemaining, 1200);
    return () => window.clearTimeout(timer);
  }, [navItems, mobileNavItems, quickItems, router]);

  useEffect(() => {
    setFabOpen(false);
    setNotesOpen(false);
  }, [pathname]);

  useEffect(() => {
    // عند عودة الإنترنت: رحّل طابور العمليات فقط — لا تعيد رفع لقطة كاملة (كانت تسبب تكرار القيود).
    const retrySync = () => {
      void drainPendingOutbox().catch(() => undefined);
    };
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

  const pageTitle = PAGE_TITLES[pathname] || "معمل هاشم";
  const isRoot = pathname === "/";

  // لا شاشة "جاري تحميل النظام" تحجب الواجهة: الصفحة الأولى التي يراها المستخدم
  // هي الشاشة الرئيسية مباشرة (كان الحجب الكامل يظهر عند كل فتح للتطبيق).

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Toaster richColors position="top-center" dir="rtl" />

      <div className="flex min-h-dvh w-full">
        {/* ————— القائمة الجانبية ————— */}
        <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-line/70 bg-paper xl:flex">
          <div className="flex items-center gap-3 border-b border-line/70 px-4 py-4">
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft shadow-soft">
              <img
                src={organizationLogo || "/icons/icon-192.png"}
                alt="شعار المعمل"
                className="size-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight text-ink">
                {settings.name || "معمل هاشم"}
              </p>
              <p className="text-[11px] font-bold text-muted">نظام إدارة التطريز</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="overline mb-1.5 px-3">{group.label}</p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.to;
                    const badge =
                      item.to === "/inventory" && lowStock.length > 0 ? lowStock.length : undefined;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        preload="intent"
                        className={cn(
                          "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors duration-100",
                          active
                            ? "bg-brand-soft text-brand-dark"
                            : "text-muted hover:bg-canvas hover:text-ink",
                        )}
                      >
                        {active ? (
                          <span
                            className="absolute -right-3 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-full bg-brand"
                            aria-hidden
                          />
                        ) : null}
                        <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                        <span className="truncate">{item.label}</span>
                        {badge ? (
                          <span className="num mr-auto rounded-full bg-bad-soft px-1.5 py-0.5 text-[11px] font-black text-bad">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {!navItems.length ? (
              <p className="px-3 py-2 text-xs text-muted">
                لا توجد شاشات مسموحة لهذا الحساب. راجع الأدوار من حساب المدير.
              </p>
            ) : null}
          </nav>

          <div className="border-t border-line/70 p-3">
            <div className="rounded-2xl bg-canvas p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    cloudState === "offline"
                      ? "bg-bad-soft text-bad"
                      : cloudState === "unknown"
                        ? "bg-canvas text-muted ring-1 ring-line"
                        : "bg-good-soft text-good",
                  )}
                >
                  {cloudState === "offline" ? (
                    <WifiOff className="size-3.5" />
                  ) : (
                    <Wifi className={cn("size-3.5", cloudState === "unknown" && "opacity-50")} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-ink">
                    {cloudState === "unknown"
                      ? "جارٍ التحقق…"
                      : cloudState === "offline"
                        ? "غير متصل"
                        : "متصل بالسحابة"}
                  </p>
                  <p className="truncate text-[11px] font-bold text-muted">
                    {cloudState === "unknown"
                      ? "جارٍ تحميل بيانات الجهاز…"
                      : pendingSyncCount > 0
                        ? `${pendingSyncCount} عملية بالمزامنة`
                        : "كل البيانات محدّثة"}
                  </p>
                </div>
                {pendingSyncCount > 0 ? (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-paper hover:text-brand"
                    aria-label="إعادة المزامنة"
                    onClick={() => {
                      try {
                        void useStore.getState().drainPendingOutbox();
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ————— الترويسة ————— */}
          <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line/60 bg-canvas/85 px-4 backdrop-blur-xl xl:px-6">
            <div className="flex min-w-0 items-center gap-2">
              {!isRoot ? (
                <Link to="/" className="btn-icon" aria-label="الرئيسية">
                  <ArrowRight className="size-5" />
                </Link>
              ) : (
                <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand xl:hidden">
                  <img
                    src={organizationLogo || "/icons/icon-192.png"}
                    alt=""
                    className="size-7 object-contain"
                  />
                </span>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-base font-black leading-tight text-ink xl:text-lg">
                  {pageTitle}
                </h1>
                <p className="hidden text-[11px] font-bold text-muted sm:block">
                  {settings.name || "معمل هاشم"} · صنعاء
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isOnline ? (
                <span className="chip bg-bad-soft text-bad">
                  <WifiOff className="size-3.5" />
                  <span className="hidden sm:inline">غير متصل</span>
                </span>
              ) : null}

              <div className="relative">
                <button
                  type="button"
                  className="btn-icon relative"
                  onClick={() => setNotesOpen((v) => !v)}
                  aria-label="التنبيهات"
                >
                  <Bell className="size-5" />
                  {lowStock.length > 0 ? (
                    <span className="num absolute -left-1 -top-1 flex size-5 min-w-5 items-center justify-center rounded-full bg-bad px-1 text-[11px] font-black text-brand-fg">
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
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        /*
                         * على الجوال تتمدد اللوحة بين حافتي الشاشة (`fixed inset-x-3`) لأن اللوحة
                         * المثبّتة أسفل زر التنبيهات كانت تخرج عن الشاشة عند العرض 320px، وعلى
                         * الحاسوب تبقى قائمة منسدلة بعرض ثابت أسفل الزر.
                         */
                        transition={{ duration: 0.1 }}
                        className="fixed inset-x-3 top-[4.25rem] z-40 origin-top-left overflow-hidden rounded-3xl border border-line/70 bg-paper shadow-pop sm:absolute sm:inset-x-auto sm:left-0 sm:top-12 sm:w-80"
                      >
                        <div className="flex items-center justify-between border-b border-line/70 bg-canvas/70 px-4 py-3">
                          <p className="text-sm font-black text-ink">تنبيهات المخزن</p>
                          {lowStock.length > 0 ? (
                            <span className="num chip bg-bad-soft text-bad">{lowStock.length}</span>
                          ) : null}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {lowStock.length === 0 ? (
                            <div className="flex flex-col items-center px-4 py-8 text-center">
                              <span className="flex size-10 items-center justify-center rounded-2xl bg-good-soft text-good">
                                <Boxes className="size-5" />
                              </span>
                              <p className="mt-2 text-sm font-bold text-ink">
                                كل الكميات بحالة جيدة
                              </p>
                              <p className="text-xs text-muted">لا يوجد صنف تحت الحد الأدنى</p>
                            </div>
                          ) : (
                            lowStock.map((item) => (
                              <Link
                                key={item.id}
                                to="/inventory"
                                className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0 hover:bg-brand-soft/40"
                              >
                                <span className="flex size-8 items-center justify-center rounded-xl bg-bad-soft text-bad">
                                  <AlertTriangle className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-ink">{item.name}</p>
                                  <p className="num text-[11px] font-bold text-bad">
                                    المتبقي {item.quantity} / الحد {item.minQuantity || 0}
                                  </p>
                                </div>
                              </Link>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {canOpenSettings ? (
                <Link to="/settings" className="btn-icon" aria-label="الإعدادات">
                  <Settings className="size-5" />
                </Link>
              ) : null}
            </div>
          </header>

          <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-4 xl:px-8 xl:pb-12">
            {!AUTH_REQUIRED ? (
              <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft/70 px-3.5 py-2 text-[11px] font-bold text-warn">
                <ShieldAlert className="size-4 shrink-0" />
                <span>
                  وضع الإعداد: تسجيل الدخول موقوف مؤقتًا — النظام مفتوح لمن يملك الرابط. أعِد تفعيله
                  قبل التشغيل الفعلي.
                </span>
              </div>
            ) : null}

            {cloudState === "offline" ? (
              <div
                className="mb-3 flex items-center gap-2.5 rounded-2xl border border-bad/25 bg-bad-soft/70 px-3.5 py-2 text-[11px] font-bold text-bad"
                role="status"
              >
                <WifiOff className="size-4 shrink-0" />
                غير متصل — البيانات تُحفظ على الجهاز وتُرفع عند عودة الاتصال.
              </div>
            ) : cloudState !== "unknown" && pendingSyncCount > 0 ? (
              <div
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-soft/70 px-3.5 py-2 text-[11px] font-bold text-warn"
                role="status"
              >
                <span>جارٍ مزامنة {pendingSyncCount} عملية مع السحابة…</span>
                <button
                  type="button"
                  className="rounded-lg border border-warn/40 px-2 py-1 text-[11px] font-black transition hover:bg-warn/10"
                  onClick={() => {
                    try {
                      useStore.getState().clearStuckOutbox?.();
                      void useStore.getState().drainPendingOutbox();
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : null}

            <div className="w-full">
              {!pathAllowed ? (
                <div className="mx-auto max-w-md card p-8 text-center">
                  <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-warn-soft text-warn">
                    <ShieldAlert className="size-6" />
                  </span>
                  <p className="text-lg font-black text-ink">لا توجد صلاحية لفتح هذه الشاشة</p>
                  <p className="mt-2 text-sm text-muted">
                    دورك الحالي لا يسمح بالوصول إلى هذه الصفحة. اطلب من المدير تفعيل الشاشة أو
                    الإجراء من «الأدوار وصلاحيات الشاشات».
                  </p>
                  {firstAllowed ? (
                    <Link to={firstAllowed as never} className="btn-primary mt-6 inline-flex">
                      فتح أول شاشة مسموحة
                    </Link>
                  ) : null}
                </div>
              ) : (
                <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
              )}
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
            transition={{ duration: 0.08 }}
            className="no-print fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] xl:hidden"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="no-print fixed bottom-28 left-1/2 z-50 flex w-64 -translate-x-1/2 flex-col gap-2 xl:hidden"
          >
            {quickItems.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.to}
                  to={q.to}
                  preload="intent"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 bg-paper px-4 py-3 shadow-pop"
                >
                  <span className="text-sm font-black text-ink">{q.label}</span>
                  <span
                    className={cn("flex size-9 items-center justify-center rounded-xl", q.tone)}
                  >
                    <Icon className="size-5" />
                  </span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_34px_-14px_rgba(20,50,58,0.25)] backdrop-blur-xl xl:hidden">
        <div className="relative mx-auto flex h-[4.5rem] max-w-lg items-center justify-around px-2">
          <button
            type="button"
            className={cn(
              "absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-canvas text-brand-fg shadow-pop transition-[transform,background-color] duration-200",
              fabOpen ? "rotate-45 bg-brand-dark" : "bg-brand",
            )}
            onClick={() => setFabOpen((v) => !v)}
            aria-label={fabOpen ? "إغلاق الإجراءات" : "إجراءات سريعة"}
          >
            {fabOpen ? <X className="size-7" /> : <ArrowUp className="size-7 stroke-[3]" />}
          </button>
          {mobileNavItems.map((item, i) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 pt-1 text-[11px] font-bold transition-colors",
                  i === 1 && "ml-10",
                  i === 2 && "mr-10",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-2xl transition-colors",
                    active && "bg-brand-soft",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
