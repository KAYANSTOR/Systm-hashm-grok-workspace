import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users, KeyRound, ArrowRight } from "lucide-react";
import {
  getEmployeeRoles,
  listEmployees,
  listPermissions,
  setEmployeeRole,
  setRolePermissions,
} from "../server/employees";

export const Route = createFileRoute("/settings/access-control")({ component: AccessControlSettingsPage });

type Employee = {
  id: string;
  name: string;
  is_active: boolean;
  user_id?: string | null;
  user_email?: string | null;
  roles?: string[];
};
type Role = { id: string; name: string; description?: string | null; permission_count?: number };
type Permission = { id: string; name: string };

export default function AccessControlSettingsPage() {
  const [tab, setTab] = useState<"employees" | "roles">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleForEmployee, setRoleForEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, roleRows] = await Promise.all([listEmployees(), getEmployeeRoles()]);
      setEmployees(employeeRows as Employee[]);
      setRoles(roleRows as Role[]);
      if (!selectedRole && roleRows.length) setSelectedRole(String((roleRows as any)[0].id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل إعدادات الصلاحيات");
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    try {
      const rows = await listPermissions();
      setPermissions(rows as Permission[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل قائمة الصلاحيات");
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (tab === "roles") void loadPermissions(); }, [tab]);

  const activeEmployee = useMemo(() => employees.find((e) => e.id === selectedEmployee), [employees, selectedEmployee]);
  const selectedRoleRow = useMemo(() => roles.find((r) => r.id === selectedRole), [roles, selectedRole]);

  useEffect(() => {
    setRoleForEmployee(activeEmployee?.roles?.[0] || "operator");
  }, [activeEmployee]);

  useEffect(() => {
    // The API exposes the permission count, while the actual permission list is
    // loaded on demand. Keep existing checked state until the user edits/saves.
    setSelectedPermissions([]);
  }, [selectedRole]);

  async function saveEmployeeRole() {
    if (!selectedEmployee || !roleForEmployee) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await setEmployeeRole({ data: { employeeId: selectedEmployee, roleId: roleForEmployee } });
      setMessage("تم تحديث دور الموظف بنجاح.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث دور الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function saveRolePermissions() {
    if (!selectedRole) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await setRolePermissions({ data: { roleId: selectedRole, permissionIds: selectedPermissions } });
      setMessage("تم حفظ صلاحيات الدور بنجاح.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ صلاحيات الدور");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link to="/settings" className="hover:text-brand">الإعدادات</Link>
            <ArrowRight className="size-4 rotate-180" />
            <span>الوصول والصلاحيات</span>
          </div>
          <h1 className="page-title mt-2">إدارة الوصول</h1>
          <p className="page-subtitle">الموظفون، حسابات الدخول، الأدوار والصلاحيات في مكان واحد.</p>
        </div>
        <Link to="/employees" className="btn-ghost">
          <Users className="size-4" />
          إدارة الموظفين
        </Link>
      </div>

      {(error || message) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-bad/30 bg-bad-soft text-bad" : "border-good/30 bg-good-soft text-good"}`}>
          {error || message}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line">
          <button type="button" onClick={() => setTab("employees")} className={`flex items-center justify-center gap-2 px-5 py-4 text-sm font-black ${tab === "employees" ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas"}`}>
            <Users className="size-4" /> الموظفون والأدوار
          </button>
          <button type="button" onClick={() => setTab("roles")} className={`flex items-center justify-center gap-2 px-5 py-4 text-sm font-black ${tab === "roles" ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas"}`}>
            <KeyRound className="size-4" /> الأدوار والصلاحيات
          </button>
        </div>

        {loading ? <div className="p-8 text-center text-sm text-muted">جاري تحميل بيانات الوصول…</div> : tab === "employees" ? (
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="border-b border-line bg-canvas/50 px-4 py-3 font-black">الموظفون</div>
              <div className="divide-y divide-line">
                {employees.map((e) => (
                  <button type="button" key={e.id} onClick={() => setSelectedEmployee(e.id)} className={`flex w-full items-center justify-between gap-3 p-4 text-right transition ${selectedEmployee === e.id ? "bg-brand-soft/70" : "hover:bg-canvas"}`}>
                    <div>
                      <div className="font-bold">{e.name}</div>
                      <div className="mt-1 text-xs text-muted">{e.user_email || "لا يوجد حساب دخول"}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${e.is_active ? "bg-good-soft text-good" : "bg-canvas text-muted"}`}>{e.is_active ? "فعال" : "مؤرشف"}</span>
                  </button>
                ))}
                {!employees.length && <div className="p-8 text-center text-sm text-muted">لا يوجد موظفون.</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas/40 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><ShieldCheck className="size-5" /></div>
                <div><h2 className="font-black">تعيين الدور</h2><p className="text-xs text-muted">تغيير صلاحيات الموظف من خلال الدور المرتبط بالحساب.</p></div>
              </div>
              {activeEmployee ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-white p-4"><p className="font-bold">{activeEmployee.name}</p><p className="text-xs text-muted">{activeEmployee.user_email || "بدون حساب"}</p></div>
                  <label className="block text-sm"><span className="mb-2 block font-bold">الدور</span><select className="input-field" value={roleForEmployee} onChange={(e) => setRoleForEmployee(e.target.value)} disabled={!activeEmployee.user_id}><option value="">اختر دورًا</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                  <button type="button" disabled={!activeEmployee.user_id || saving} onClick={() => void saveEmployeeRole()} className="btn-primary w-full">حفظ الدور</button>
                  {!activeEmployee.user_id && <p className="text-xs text-bad">أنشئ حساب دخول للموظف أولًا من شاشة الموظفين.</p>}
                </div>
              ) : <p className="mt-6 text-sm text-muted">اختر موظفًا من القائمة لإدارة دوره.</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 p-6 lg:grid-cols-[.8fr_1.2fr]">
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="border-b border-line bg-canvas/50 px-4 py-3 font-black">الأدوار</div>
              <div className="divide-y divide-line">{roles.map((r) => <button type="button" key={r.id} onClick={() => setSelectedRole(r.id)} className={`w-full p-4 text-right ${selectedRole === r.id ? "bg-brand-soft/70" : "hover:bg-canvas"}`}><div className="font-bold">{r.name}</div><div className="mt-1 text-xs text-muted">{r.description || "بدون وصف"}</div><div className="mt-2 text-[11px] text-brand">{r.permission_count ?? 0} صلاحية</div></button>)}</div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas/40 p-5">
              <div><h2 className="font-black">صلاحيات {selectedRoleRow?.name || "الدور"}</h2><p className="text-xs text-muted">حدد العمليات التي يسمح بها هذا الدور. يطبق الخادم الصلاحيات فعليًا.</p></div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {permissions.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
                    <input type="checkbox" checked={selectedPermissions.includes(p.id)} onChange={(e) => setSelectedPermissions((current) => e.target.checked ? [...new Set([...current, p.id])] : current.filter((id) => id !== p.id))} />
                    <span><span className="block font-bold">{p.name}</span><span className="text-[10px] text-muted">{p.id}</span></span>
                  </label>
                ))}
              </div>
              <button type="button" disabled={!selectedRole || saving} onClick={() => void saveRolePermissions()} className="btn-primary mt-5 w-full">حفظ صلاحيات الدور</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
