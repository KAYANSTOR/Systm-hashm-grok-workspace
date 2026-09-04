import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, RotateCcw, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetDemo = useStore((s) => s.resetDemo);
  const importData = useStore((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(settings);

  const exportJson = () => {
    const data = useStore.getState();
    const payload: AppData = {
      customers: data.customers,
      suppliers: data.suppliers,
      inventory: data.inventory,
      invoices: data.invoices,
      vouchers: data.vouchers,
      transactions: data.transactions,
      expenses: data.expenses,
      settings: data.settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hashem-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل النسخة الاحتياطية");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppData;
      if (!Array.isArray(data.customers) || !Array.isArray(data.invoices)) {
        throw new Error("ملف غير صالح");
      }
      importData(data);
      setForm(useStore.getState().settings);
      toast.success("تم استعادة البيانات");
    } catch {
      toast.error("تعذر قراءة الملف");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">الإعدادات</h1>
        <p className="page-subtitle">بيانات المعمل والنسخ الاحتياطي.</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-black">بيانات المعمل</h2>
        <div className="grid gap-3">
          <label>
            <span className="label">الاسم</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            <span className="label">العنوان</span>
            <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">هاتف 1</span>
              <input className="input-field" dir="ltr" value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} />
            </label>
            <label>
              <span className="label">هاتف 2</span>
              <input className="input-field" dir="ltr" value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />
            </label>
          </div>
          <button
            type="button"
            className="btn-primary self-start"
            onClick={() => {
              updateSettings(form);
              toast.success("تم حفظ بيانات المعمل");
            }}
          >
            <Save className="size-4" />
            حفظ
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 font-black">البيانات</h2>
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-right hover:bg-canvas"
          onClick={exportJson}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Download className="size-5" />
            </span>
            <div>
              <p className="font-bold">تنزيل نسخة احتياطية</p>
              <p className="text-xs text-muted">ملف JSON يمكن استعادته لاحقاً</p>
            </div>
          </div>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between border-t border-line px-5 py-4 text-right hover:bg-canvas"
          onClick={() => fileRef.current?.click()}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-good-soft text-good">
              <Upload className="size-5" />
            </span>
            <div>
              <p className="font-bold">استعادة من ملف</p>
              <p className="text-xs text-muted">يستبدل البيانات الحالية</p>
            </div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="flex w-full items-center justify-between border-t border-line px-5 py-4 text-right hover:bg-canvas"
          onClick={() => {
            if (confirm("إعادة تحميل البيانات التجريبية؟ سيتم استبدال البيانات الحالية.")) {
              resetDemo();
              setForm(useStore.getState().settings);
              toast.success("تم تحميل بيانات التجربة");
            }
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-warn-soft text-warn">
              <RotateCcw className="size-5" />
            </span>
            <div>
              <p className="font-bold">إعادة بيانات التجربة</p>
              <p className="text-xs text-muted">عملاء، مخزن، وفواتير جاهزة للتجربة</p>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-3 border-t border-line px-5 py-4 text-muted">
          <Database className="size-5" />
          <p className="text-xs">البيانات تُحفظ على هذا الجهاز فقط. لا تُرفع إلى الإنترنت.</p>
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-muted">
        معمل هاشم · الإصدار 2.0 · صنعاء
      </p>
    </div>
  );
}
