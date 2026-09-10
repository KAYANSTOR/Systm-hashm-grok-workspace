import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  archiveEmployee,
  createEmployee,
  createEmployeeAccount,
  getEmployeeRoles,
  listEmployees,
  setEmployeeAccountStatus,
  setEmployeeRole,
} from "../server/employees";

export const Route = createFileRoute("/employees")({ component: EmployeesPage });

type Employee = {
  id: string;
  name: string;
  phone?: string | null;
  is_active: boolean;
  user_id?: string | null;
  account_active?: boolean;
  roles?: string[];
};
type Role = { id: string; name: string; description?: string | null };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", password: "", roleId: "operator" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, roleRows] = await Promise.all([listEmployees(), getEmployeeRoles()]);
      setEmployees(employeeRows as Employee[]);
      setRoles(roleRows as Role[]);
      setForm((current) => ({ ...current, roleId: current.roleId || String((roleRows as Role[])[0]?.id || "operator") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function onCreateEmployee(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone || form.password.length < 8) {
      setError("أدخل الاسم ورقم الهاتف وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Employee profile contains only name + phone. The password belongs to
      // Better Auth and is never stored in the employee table.
      const created = await createEmployee({ data: { name, phone } });
      await createEmployeeAccount({ data: { employeeId: String((created as any).id), password: form.password, roleId: form.roleId } });
      setForm({ name: "", phone: "", password: "", roleId: form.roleId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الموظف والحساب");
    } finally {
      setSaving(false);
    }
  }

  async function onArchive(id: string) {
    try { await archiveEmployee({ data: { id } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر أرشفة الموظف"); }
  }

  async function onRole(employeeId: string, roleId: string) {
    try { await setEmployeeRole({ data: { employeeId, roleId } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث الدور"); }
  }

  async function onAccountStatus(employeeId: string, isActive: boolean) {
    try { await setEmployeeAccountStatus({ data: { employeeId, isActive } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث حالة الحساب"); }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-stone-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-500"><Link to="/settings">الإعدادات</Link><ArrowRight className="size-4 rotate-180" /><span>الموظفون</span></div>
            <h1 className="mt-2 text-2xl font-bold">الموظفون ومستخدمو النظام</h1>
            <p className="mt-1 text-sm text-zinc-500">بيانات الموظف: الاسم ورقم الهاتف. كلمة المرور تستخدم لحساب الدخول ولا تُخزن في ملف الموظف.</p>
          </div>
          <Link to="/settings/access-control" className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"><ShieldCheck className="size-4" />الأدوار والصلاحيات</Link>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={onCreateEmployee} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">إضافة موظف ومستخدم للنظام</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm"><span className="mb-1 block text-zinc-600">الاسم</span><input required className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
            <label className="text-sm"><span className="mb-1 block text-zinc-600">رقم الهاتف</span><input required type="tel" inputMode="tel" dir="ltr" autoComplete="tel" className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600" value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} /></label>
            <label className="text-sm"><span className="mb-1 block text-zinc-600">كلمة المرور</span><input required type="password" minLength={8} autoComplete="new-password" placeholder="8 أحرف على الأقل" className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} /></label>
            <label className="text-sm"><span className="mb-1 block text-zinc-600">الدور</span><select className="w-full rounded-xl border border-zinc-200 px-3 py-2" value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          </div>
          <button disabled={saving} className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "جارٍ إنشاء الحساب…" : "إضافة الموظف"}</button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4 font-semibold">قائمة الموظفين</div>
          {loading ? <div className="p-6 text-sm text-zinc-500">جاري التحميل…</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3 text-right">الموظف</th><th className="px-4 py-3 text-right">الحساب</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3 text-right">الدور</th><th className="px-4 py-3 text-right">الإجراء</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">{employees.map((e) => <tr key={e.id} className={!e.is_active ? "opacity-50" : ""}><td className="px-4 py-3"><div className="font-medium">{e.name}</div><div className="text-xs text-zinc-500">{e.phone || "—"}</div></td><td className="px-4 py-3">{e.user_id ? "مرتبط بحساب دخول" : "غير مرتبط"}</td><td className="px-4 py-3">{e.user_id ? <button type="button" onClick={() => void onAccountStatus(e.id, e.account_active !== true)} className={`rounded-full px-3 py-1 text-xs font-bold ${e.account_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.account_active ? "حساب فعال" : "حساب موقوف"}</button> : <span className="text-zinc-400">بدون حساب</span>}</td><td className="px-4 py-3">{e.user_id ? <select className="rounded-lg border px-2 py-1" value={e.roles?.[0] || "viewer"} onChange={(ev) => void onRole(e.id, ev.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : "—"}</td><td className="px-4 py-3">{e.is_active && <button type="button" onClick={() => void onArchive(e.id)} className="rounded-lg border border-red-200 px-3 py-1 text-red-700">أرشفة</button>}</td></tr>)}
            {!employees.length && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">لا يوجد موظفون بعد.</td></tr>}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
