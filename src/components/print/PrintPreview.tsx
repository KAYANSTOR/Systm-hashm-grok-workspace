import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, Minus, Plus, Printer, RotateCcw, Share2, X } from "lucide-react";
import "./print.css";

export type PaperKind = "a4" | "receipt" | "a4-voucher-sheet";

export interface PrintPreviewProps {
  /** عنوان المعاينة أعلى الشاشة (مثال: «معاينة الفاتورة»). */
  title: string;
  /** سطر توضيحي أسفل العنوان (نوع الورق وما سيحدث عند الطباعة). */
  subtitle?: string;
  /** مقاس الورق — يحدد `@page` والأبعاد الفعلية للمستند. */
  paper: PaperKind;
  /** اسم ملف PDF عند التنزيل/المشاركة بلا امتداد. */
  fileName: string;
  /** نص مصاحب عند مشاركة الملف عبر واتساب/المشاركة النظامية. */
  shareText?: string;
  /** زر إضافي في الشريط (مثال: اعتماد المستند). */
  extraAction?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

interface PaperMetrics {
  widthPx: number;
  heightPx: number;
  cssSize: string;
  label: string;
  screenClass: string;
}

/**
 * مقاسات الورق الفعلية. العرض ثابت 210mm في الحالتين لأنه عرض ورقة A4،
 * والسند يُطبع على نفس العرض بارتفاع نصف A4 (نظام دفاتر السندات الشائع).
 */
const PAPERS: Record<PaperKind, PaperMetrics> = {
  a4: {
    widthPx: 793.7,
    heightPx: 1122.5,
    cssSize: "A4 portrait",
    label: "A4 · 210×297 مم",
    screenClass: "print-page--a4",
  },
  receipt: {
    widthPx: 793.7,
    heightPx: 396.9,
    cssSize: "210mm 105mm",
    label: "سند · 210×105 مم",
    screenClass: "print-page--receipt",
  },
  "a4-voucher-sheet": {
    widthPx: 793.7,
    heightPx: 1122.5,
    cssSize: "A4 portrait",
    label: "A4 · نسختان",
    screenClass: "print-page--a4",
  },
};

const ZOOM_STEPS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];

function nextZoom(current: number, direction: 1 | -1): number {
  if (direction === 1)
    return ZOOM_STEPS.find((step) => step > current + 0.001) ?? ZOOM_STEPS.at(-1)!;
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? ZOOM_STEPS[0];
}

/**
 * معاينة وطباعة موحّدة لكل المستندات (فاتورة · سند · كشف حساب · تقرير).
 *
 * لماذا هذا المكوّن؟
 *  - **طباعة حقيقية**: المستند يُطبع كنص متجهي من نفس الصفحة، فلا صور باهتة
 *    ولا خطوط مفقودة، ولا يلزم فتح نافذة منبثقة (كانت تُحجب فيفشل الأمر).
 *  - **معاينة قبل الطباعة**: المستخدم يرى الورقة بمقاسها الحقيقي ويقرّب/يبعد
 *    ويتأكد من الأرقام قبل أن يستهلك ورقة.
 *  - **تنزيل PDF ومشاركة** بنفس الشكل الظاهر في المعاينة.
 */
export default function PrintPreview({
  title,
  subtitle,
  paper,
  fileName,
  shareText,
  extraAction,
  onClose,
  children,
}: PrintPreviewProps) {
  const metrics = PAPERS[paper];
  const pageRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(0.75);
  const [fitMode, setFitMode] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "share">(null);
  const [message, setMessage] = useState("");
  const [fitScale, setFitScale] = useState(0.75);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ملاءمة العرض: نقيس المساحة المتاحة فلا تخرج الورقة عن الشاشة على الجوال.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const compute = () => {
      const available = stage.clientWidth - 28;
      setFitScale(Math.max(0.3, Math.min(1, available / metrics.widthPx)));
    };
    compute();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(compute);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [metrics.widthPx]);

  const effectiveZoom = fitMode ? fitScale : zoom;
  // أعلى الورقة في المعاينة قد يكون أطول من الشاشة (الفواتير الطويلة)، فنحجز
  // الارتفاع بعد التقريب حتى يبقى شريط التمرير منطقيًا.
  const stageHeight = useMemo(
    () => (paper === "receipt" ? metrics.heightPx : metrics.heightPx) * effectiveZoom,
    [effectiveZoom, metrics.heightPx, paper],
  );

  const handlePrint = useCallback(async () => {
    setMessage("");
    try {
      // انتظر تحميل الخط قبل الطباعة: بدونه يُطبع السند بخط احتياطي.
      await document.fonts?.ready;
    } catch {
      /* لا نُفشل الطباعة بسبب الخط */
    }
    document.documentElement.classList.add("printing");
    const cleanup = () => {
      document.documentElement.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // بعض المتصفحات (وخاصة الجوال) لا تُطلق afterprint دائمًا.
    window.setTimeout(cleanup, 4000);
  }, []);

  const buildPdfBlob = useCallback(async (): Promise<Blob | null> => {
    const element = pageRef.current;
    if (!element) return null;
    try {
      await document.fonts?.ready;
      const [{ toJpeg }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const dataUrl = await toJpeg(element, {
        quality: 0.96,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height,
        style: { transform: "none", width: `${width}px`, height: `${height}px` },
        filter: (node: HTMLElement) => !node.classList?.contains("no-print"),
      });
      const pdfWidth = 210;
      const probe = new jsPDF();
      const image = probe.getImageProperties(dataUrl);
      const pdfHeight = (image.height * pdfWidth) / image.width;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      return pdf.output("blob");
    } catch (error) {
      console.error("تعذر إنشاء ملف PDF", error);
      return null;
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setBusy("pdf");
    setMessage("");
    try {
      const blob = await buildPdfBlob();
      if (!blob) {
        setMessage("تعذر إنشاء ملف PDF. جرّب الطباعة مباشرة أو أعد المحاولة.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage("تم تجهيز ملف PDF وتنزيله.");
    } finally {
      setBusy(null);
    }
  }, [buildPdfBlob, fileName]);

  const handleShare = useCallback(async () => {
    setBusy("share");
    setMessage("");
    try {
      const blob = await buildPdfBlob();
      if (!blob) {
        setMessage("تعذر تجهيز الملف للمشاركة. استخدم «تنزيل PDF» ثم أرسل الملف.");
        return;
      }
      const file = new File([blob], `${fileName}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text: shareText, files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage("متصفحك لا يدعم مشاركة الملفات — نزّلنا PDF لتشاركه يدويًا.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        setMessage("تعذرت المشاركة. جرّب «تنزيل PDF».");
      }
    } finally {
      setBusy(null);
    }
  }, [buildPdfBlob, fileName, shareText, title]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        void handlePrint();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [handlePrint, onClose]);

  const documentBody = (
    <div ref={pageRef} className={`print-page ${metrics.screenClass}`}>
      {children}
    </div>
  );

  return (
    <>
      <div
        className="print-overlay no-print"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="print-toolbar">
          <div className="print-toolbar__title">
            <h2>{title}</h2>
            <p>
              {subtitle ? `${subtitle} · ` : ""}
              {metrics.label} · Ctrl+P للطباعة
            </p>
          </div>

          <div className="print-toolbar__actions">
            <div className="print-zoom" role="group" aria-label="تكبير المعاينة">
              <button
                type="button"
                onClick={() => {
                  setFitMode(false);
                  setZoom((z) => nextZoom(fitMode ? fitScale : z, -1));
                }}
                aria-label="تصغير"
              >
                <Minus className="size-4" />
              </button>
              <span>{Math.round(effectiveZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => {
                  setFitMode(false);
                  setZoom((z) => nextZoom(fitMode ? fitScale : z, 1));
                }}
                aria-label="تكبير"
              >
                <Plus className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setFitMode(true)}
                aria-label="ملاءمة العرض"
                title="ملاءمة العرض"
                className={fitMode ? "bg-brand-soft" : ""}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>

            {extraAction}

            <button
              type="button"
              className="print-btn"
              onClick={() => void handleShare()}
              disabled={busy !== null}
            >
              <Share2 className="size-4" />
              <span>مشاركة</span>
            </button>
            <button
              type="button"
              className="print-btn"
              onClick={() => void handleDownload()}
              disabled={busy !== null}
            >
              <Download className="size-4" />
              <span>{busy === "pdf" ? "جارٍ التجهيز…" : "تنزيل PDF"}</span>
            </button>
            <button
              type="button"
              className="print-btn print-btn--primary"
              onClick={() => void handlePrint()}
            >
              <Printer className="size-4" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              className="print-btn print-btn--danger"
              onClick={onClose}
              aria-label="إغلاق المعاينة"
            >
              <X className="size-4" />
              <span>إغلاق</span>
            </button>
          </div>
        </header>

        {message ? (
          <p
            className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-xs font-bold text-warn"
            role="status"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            {message}
          </p>
        ) : null}

        <div className="print-stage" ref={stageRef}>
          <div
            className="print-stage__inner"
            style={{
              transform: `scale(${effectiveZoom})`,
              height: stageHeight ? `${stageHeight}px` : undefined,
            }}
          >
            {documentBody}
          </div>
        </div>
      </div>

      {mounted
        ? createPortal(
            <div className="app-print-root" dir="rtl">
              <style>{`@page { size: ${metrics.cssSize}; margin: 0; }`}</style>
              <div className={`print-page ${metrics.screenClass}`}>{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
