import { useEffect, useState } from "react";
import { Cloud, Database, RefreshCw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { forceAllowFetch, syncErrorMessage, useStore } from "@/lib/store";
import { Alert, Chip, KeyValue, SectionCard } from "@/components/ui/kit";

/**
 * التخزين والمزامنة — يشرح للمستخدم أين تُحفظ بياناته ومتى تُرفع، ويعطيه زر
 * مزامنة يدويًا مع نتيجة واضحة (كم عملية بقي معلّقة ولماذا).
 */
export function SyncPanel() {
  const connectionState = useStore((s) => s.connectionState);
  const pendingSyncCount = useStore((s) => s.pendingSyncCount);
  const lastSyncMessage = useStore((s) => s.lastSyncMessage);
  const initialDataLoaded = useStore((s) => s.initialDataLoaded);

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const syncNow = async () => {
    if (!isOnline) {
      toast.error("لا يمكن المزامنة قبل عودة الإنترنت");
      return;
    }
    setIsSyncing(true);
    try {
      await useStore.getState().drainPendingOutbox();
      forceAllowFetch();
      await useStore.getState().fetchFromDb();
      const pending = useStore.getState().pendingSyncCount;
      if (pending > 0) {
        toast.error(`تبقّى ${pending} عملية بانتظار الترحيل. راجع الاتصال أو الصلاحيات.`);
      } else {
        toast.success("تمت مزامنة العمليات وتحديث البيانات من السحابة");
      }
    } catch (error) {
      toast.error(`${syncErrorMessage(error)} ستبقى البيانات محفوظة على هذا الجهاز.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const isOffline = !isOnline || connectionState === "offline";

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionCard
        title="التخزين والمزامنة"
        subtitle="التغييرات تُحفظ محليًا أولًا ثم تُرحَّل عبر طابور العمليات"
        icon={Cloud}
        tone="accent"
        action={
          <Chip tone={isOffline ? "bad" : connectionState === "syncing" ? "brand" : "good"}>
            {isOffline ? "غير متصل" : connectionState === "syncing" ? "جارٍ المزامنة" : "متصل"}
          </Chip>
        }
      >
        <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              isOffline ? "bg-bad-soft text-bad" : "bg-good-soft text-good"
            }`}
          >
            {isOffline ? <WifiOff className="size-6" /> : <Wifi className="size-6" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-ink">{isOffline ? "وضع عدم الاتصال" : "متصل ومزامن"}</h3>
            <p className="text-xs font-bold text-muted">
              {isOffline
                ? "العمليات تُحفظ على الجهاز حتى عودة الإنترنت، ولا تفقد أي حركة."
                : "البيانات المحلية متتبَّعة مع آخر نسخة سحابية."}
            </p>
          </div>
          {!isOffline ? <ShieldCheck className="ms-auto size-6 shrink-0 text-good" /> : null}
        </div>

        <div className="mt-3 rounded-2xl border border-line/70 bg-paper p-3.5">
          <KeyValue label="حالة الاتصال" value={isOffline ? "غير متصل" : "متصل"} tone={isOffline ? "bad" : "good"} />
          <KeyValue
            label="عمليات بانتظار الترحيل"
            value={pendingSyncCount > 0 ? pendingSyncCount : "لا شيء"}
            tone={pendingSyncCount > 0 ? "warn" : "good"}
          />
          <KeyValue label="البيانات الأولية" value={initialDataLoaded ? "محمّلة" : "جارٍ التحميل…"} />
          <KeyValue label="آخر حالة" value={lastSyncMessage || "—"} />
        </div>

        {pendingSyncCount > 0 ? (
          <Alert tone="warn" icon={Database} title="هناك عمليات لم تُرحَّل بعد">
            لا تمسح بيانات المتصفح ولا تغلق الجهاز قبل أن تصل هذه العمليات إلى السحابة.
          </Alert>
        ) : null}

        <button
          type="button"
          className="btn-primary mt-4 w-full py-3"
          disabled={isOffline || isSyncing}
          onClick={() => void syncNow()}
        >
          <RefreshCw className={`size-5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "جارٍ المزامنة…" : "مزامنة الآن"}
        </button>
      </SectionCard>

      <SectionCard title="كيف تعمل المزامنة؟" subtitle="ثلاث خطوات تحمي بياناتك" icon={Database} tone="brand">
        <ol className="list-decimal space-y-2 pr-5 text-xs font-bold leading-6 text-muted">
          <li>كل عملية (فاتورة، سند، حركة مخزون) تُكتب في قاعدة الجهاز فورًا وتُضاف إلى «طابور العمليات».</li>
          <li>عند توفر الإنترنت يُرحَّل الطابور إلى السحابة بترتيب زمني ومع مُعرِّف فريد يمنع التكرار عند إعادة المحاولة.</li>
          <li>بعد الترحيل يُقرأ أحدث إصدار من البيانات السحابية، فإن اختلف جهازان على نفس المستند يظهر تنبيه حل التعارض.</li>
        </ol>
      </SectionCard>
    </div>
  );
}
