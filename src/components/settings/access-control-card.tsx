import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, UserPlus, Users } from "lucide-react";

export function AccessControlCard() {
  return (
    <section className="card overflow-hidden" aria-labelledby="access-control-title">
      <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Users className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 id="access-control-title" className="font-black text-brand-dark">الموظفون ومستخدمو النظام</h2>
          <p className="text-xs text-muted">إضافة الموظفين، حسابات الدخول، والأدوار والصلاحيات.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <Link
          to="/employees"
          className="group flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/40 sm:p-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand sm:size-11">
              <UserPlus className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-black text-brand-dark">قائمة الموظفين</span>
              <span className="mt-1 block text-xs text-muted">عرض، تعديل، حذف، وحسابات الدخول.</span>
            </span>
          </span>
          <ArrowLeft className="size-5 shrink-0 text-muted transition-transform group-hover:-translate-x-1 group-hover:text-brand" />
        </Link>

        <Link
          to="/settings/access-control"
          className="group flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/40 sm:p-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand sm:size-11">
              <KeyRound className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-black text-brand-dark">الأدوار وصلاحيات الشاشات</span>
              <span className="mt-1 block text-xs text-muted">حدد الشاشات والإجراءات لكل دور.</span>
            </span>
          </span>
          <ArrowLeft className="size-5 shrink-0 text-muted transition-transform group-hover:-translate-x-1 group-hover:text-brand" />
        </Link>
      </div>
    </section>
  );
}
