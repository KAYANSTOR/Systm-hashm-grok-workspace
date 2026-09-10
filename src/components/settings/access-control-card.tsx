import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, UserPlus, Users } from "lucide-react";

export function AccessControlCard() {
  return (
    <section className="card overflow-hidden md:col-span-2" aria-labelledby="access-control-title">
      <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Users className="size-5" />
        </div>
        <div>
          <h2 id="access-control-title" className="font-black text-brand-dark">الموظفون ومستخدمو النظام</h2>
          <p className="text-xs text-muted">إضافة الموظفين، إنشاء حسابات الدخول، وتحديد الأدوار والصلاحيات.</p>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <Link
          to="/employees"
          className="group flex items-center justify-between rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <UserPlus className="size-5" />
            </span>
            <span>
              <span className="block font-black text-brand-dark">إدارة الموظفين</span>
              <span className="mt-1 block text-xs text-muted">إضافة وتعديل الموظفين وحسابات الدخول.</span>
            </span>
          </span>
          <ArrowLeft className="size-5 text-muted transition-transform group-hover:-translate-x-1 group-hover:text-brand" />
        </Link>

        <Link
          to="/settings/access-control"
          className="group flex items-center justify-between rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <KeyRound className="size-5" />
            </span>
            <span>
              <span className="block font-black text-brand-dark">الأدوار والصلاحيات</span>
              <span className="mt-1 block text-xs text-muted">تعيين دور لكل موظف وإدارة صلاحيات الأدوار.</span>
            </span>
          </span>
          <ArrowLeft className="size-5 text-muted transition-transform group-hover:-translate-x-1 group-hover:text-brand" />
        </Link>
      </div>
    </section>
  );
}
