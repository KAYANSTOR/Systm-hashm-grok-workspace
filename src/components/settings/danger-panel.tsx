import { useState } from "react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Alert, SectionCard } from "@/components/ui/kit";

const RESET_PHRASE = "حذف الكل";

/**
 * منطقة الخطر — تصفية بيانات العمل من الخادم والجهاز.
 * تأكيد مزدوج: كتابة العبارة نصًّا ثم نافذة تأكيد أخيرة، مع بقاء نفس منطق
 * الأخطاء والرسائل كما كان (تمييز رفض الصلاحية عن انتهاء الجلسة).
 */
export function DangerPanel() {
  const resetDatabase = useStore((s) => s.resetDatabase);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const runResetDatabase = async () => {
    if (resetConfirmText.trim() !== RESET_PHRASE) {
      toast.error(`اكتب عبارة التأكيد بالضبط: ${RESET_PHRASE}`);
      return;
    }
    if (
      !window.confirm(
        "تأكيد أخير: سيتم حذف الفواتير والعملاء والمنتجات والقيود من قاعدة البيانات. المتابعة؟",
      )
    ) {
      return;
    }
    setIsResetting(true);
    const loadingId = toast.loading("جاري تصفية قاعدة البيانات على الخادم والجهاز…");
    try {
      await resetDatabase();
      setShowResetConfirm(false);
      setResetConfirmText("");
      toast.success("تم حذف وتصفية بيانات العمل بنجاح", { id: loadingId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "حدث خطأ أثناء مسح قاعدة البيانات";
      if (/Forbidden|permission|db\.reset|settings\.write/i.test(msg)) {
        toast.error("لا تملك صلاحية تصفية قاعدة البيانات. سجّل الدخول كمدير.", { id: loadingId });
      } else if (/Unauthorized/i.test(msg)) {
        toast.error("انتهت الجلسة. سجّل الدخول ثم أعد المحاولة.", { id: loadingId });
      } else {
        toast.error(msg, { id: loadingId });
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SectionCard
      title="منطقة الخطر — حذف وتصفية البيانات"
      subtitle="إجراء لا يمكن التراجع عنه"
      icon={ShieldAlert}
      tone="bad"
      className="border-bad/30"
    >
      <Alert tone="bad" icon={AlertTriangle} title="ما الذي سيُحذف بالتحديد؟">
        من الخادم والجهاز: الفواتير، العملاء، الموردون، المنتجات، القيود، المخزون، والطابور.
        <br />
        <strong className="font-black">لا يُحذف:</strong> حسابات الدخول، الأدوار، ولا الموظفون.
      </Alert>

      <div className="mt-4 space-y-4">
        {!showResetConfirm ? (
          <>
            <p className="text-xs font-bold leading-6 text-muted">
              استخدم هذا الإجراء فقط عند بدء تشغيل النظام من جديد. الأفضل تنزيل نسخة احتياطية من قسم
              «النسخ الاحتياطي» قبل المتابعة.
            </p>
            <button
              type="button"
              className="btn-primary w-full bg-bad py-3 text-white hover:bg-bad/90"
              onClick={() => {
                setShowResetConfirm(true);
                setResetConfirmText("");
              }}
            >
              <Trash2 className="size-5" />
              بدء حذف وتصفية قاعدة البيانات
            </button>
          </>
        ) : (
          <div className="space-y-3 rounded-2xl border border-bad/30 bg-bad-soft/20 p-4">
            <div className="flex items-start gap-2 text-sm text-bad">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p>
                اكتب عبارة التأكيد <strong className="font-black">«{RESET_PHRASE}»</strong> ثم اضغط
                التأكيد. هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <input
              className="input-field border-bad/40"
              placeholder={RESET_PHRASE}
              value={resetConfirmText}
              onChange={(event) => setResetConfirmText(event.target.value)}
              dir="rtl"
              autoComplete="off"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isResetting || resetConfirmText.trim() !== RESET_PHRASE}
                className="btn-primary w-full bg-bad py-3 text-white hover:bg-bad/90 disabled:opacity-50 sm:flex-1"
                onClick={() => void runResetDatabase()}
              >
                {isResetting ? "جارٍ التصفية…" : "تأكيد الحذف والتصفية الآن"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full sm:w-auto"
                disabled={isResetting}
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
