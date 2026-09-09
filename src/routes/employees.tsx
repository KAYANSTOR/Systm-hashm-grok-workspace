import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  archiveEmployee,
  createEmployee,
  createEmployeeAccount,
  getEmployeeRoles,
  listEmployees,
  setEmployeeRole,
} from "../server/employees";

export const Route = createFileRoute("/employees")({ component: EmployeesPage });

type Employee = {
  id: string;
  name: string;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  is_active: boolean;
  user_id?: string | null;
  user_email?: string | null;
  roles?: string[];
};

type Role = { id: string; name: string; description?: string | null };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", jobTitle: "", department: "" });
  const [account, setAccount] = useState({ employeeId: "", email: "", password: "", roleId: "operator" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, roleRows] = await Promise.all([listEmployees(), getEmployeeRoles()]);
      setEmployees(employeeRows as Employee[]);
      setRoles(roleRows as Role[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function onCreateEmployee(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createEmployee({ data: form });
      setForm({ name: "", phone: "", jobTitle: "", department: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function onArchive(id: string) {
    try {
      await archiveEmployee({ data: { id } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر أرشفة الموظف");
    }
  }

  async function onRole(employeeId: string, roleId: string) {
    try {
      await setEmployeeRole({ data: { employeeId, roleId } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث الدور");
    }
  }

  async function onAccount(e: FormEvent) {
    e.preventDefault();
    if (!account.employeeId || !account.email || !account.password) return;
    setSaving(true);
    setError("");
    try {
      await createEmployeeAccount({ data: account });
      setAccount({ employeeId: "", email: "", password: "", roleId: "operator" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء حساب الدخول");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-stone-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold">الموظفون والحسابات</h1>
          <p className="mt-1 text-sm text-zinc-500">إدارة بيانات الموظفين وحسابات الدخول والأدوار.</p>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={onCreateEmployee} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">إضافة موظف</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["name", "الاسم"], ["phone", "الهاتف"], ["jobTitle", "الوظيفة"], ["department", "القسم"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm">
                  <span className="mb-1 block text-zinc-600">{label}</span>
                  <input required={key === "name"} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600" value={(form as any)[key]} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))} />
                </label>
              ))}
            </div>
            <button disabled={saving} className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">حفظ الموظف</button>
          </form>

          <form onSubmit={onAccount} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">إنشاء حساب دخول</h2>
            <div className="space-y-3">
              <label className="block text-sm"><span className="mb-1 block text-zinc-600">الموظف</span>
                <select required className="w-full rounded-xl border border-zinc-200 px-3 py-2" value={account.employeeId} onChange={(e) => setAccount((v) => ({ ...v, employeeId: e.target.value }))}>
                  <option value="">اختر موظفًا</option>
                  {employees.filter((e) => e.is_active && !e.user_id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="mb-1 block text-zinc-600">البريد الإلكتروني</span><input required type="email" className="w-full rounded-xl border border-zinc-200 px-3 py-2" value={account.email} onChange={(e) => setAccount((v) => ({ ...v, email: e.target.value }))} /></label>
              <label className="block text-sm"><span className="mb-1 block text-zinc-600">كلمة المرور</span><input required type="password" minLength={8} className="w-full rounded-xl border border-zinc-200 px-3 py-2" value={account.password} onChange={(e) => setAccount((v) => ({ ...v, password: e.target.value }))} /></label>
              <label className="block text-sm"><span className="mb-1 block text-zinc-600">الدور</span>
                <select className="w-full rounded-xl border border-zinc-200 px-3 py-2" value={account.roleId} onChange={(e) => setAccount((v) => ({ ...v, roleId: e.target.value }))}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            </div>
            <button disabled={saving} className="mt-4 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">إنشاء الحساب</button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4 font-semibold">قائمة الموظفين</div>
          {loading ? <div className="p-6 text-sm text-zinc-500">جاري التحميل…</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3 text-right">الموظف</th><th className="px-4 py-3 text-right">الوظيفة</th><th className="px-4 py-3 text-right">الحساب</th><th className="px-4 py-3 text-right">الدور</th><th className="px-4 py-3 text-right">الإجراء</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {employees.map((e) => <tr key={e.id} className={!e.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-3"><div className="font-medium">{e.name}</div><div className="text-xs text-zinc-500">{e.phone || "—"}</div></td>
                    <td className="px-4 py-3">{e.job_title || "—"}{e.department ? ` · ${e.department}` : ""}</td>
                    <td className="px-4 py-3">{e.user_email || "غير مرتبط"}</td>
                    <td className="px-4 py-3">
                      {e.user_id ? <select className="rounded-lg border px-2 py-1" value={e.roles?.[0] || "operator"} onChange={(ev) => void onRole(e.id, ev.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : "—"}
                    </td>
                    <td className="px-4 py-3">{e.is_active && <button type="button" onClick={() => void onArchive(e.id)} className="rounded-lg border border-red-200 px-3 py-1 text-red-700">أرشفة</button>}</td>
                  </tr>)}
                  {!employees.length && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">لا يوجد موظفون بعد.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
