import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  archiveEmployee,
  createEmployee,
  createEmployeeAccount,
  deleteEmployee,
  getEmployeeRoles,
  listEmployees,
  resetEmployeePassword,
  restoreEmployee,
  setEmployeeAccountStatus,
  setEmployeeRole,
  updateEmployee,
} from "../server/employees";
import { useCurrentUserState } from "../lib/auth/use-current-user";

export const Route = createFileRoute("/employees")({ component: EmployeesPage });

type Employee = {
  id: string;
  name: string;
  phone?: string | null;
  is_active: boolean;
  user_id?: string | null;
  account_active?: boolean;
  roles?: string[];
  user_email?: string | null;
};

type Role = { id: string; name: string; description?: string | null };

export default function EmployeesPage() {
  const { user, isPending: isSessionPending } = useCurrentUserState();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", password: "", roleId: "operator" });
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, roleRows] = await Promise.all([listEmployees(), getEmployeeRoles()]);
      const list = (employeeRows as Employee[]) || [];
      setEmployees(list);
      setRoles(roleRows as Role[]);
      setForm((current) => ({
        ...current,
        roleId: current.roleId || String((roleRows as Role[])[0]?.id || "operator"),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر تحميل الموظفين";
      if (/Unauthorized/i.test(msg)) {
        setError("تعذر تحميل القائمة: الجلسة غير صالحة. سجّل الدخول مجددًا بحساب المدير.");
      } else if (/Forbidden|permission/i.test(msg)) {
        setError("حسابك لا يملك صلاحية عرض الموظفين (employees.read).");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSessionPending || !user) return;
    void load();
  }, [isSessionPending, user]);

  const visible = useMemo(
    () => (showArchived ? employees : employees.filter((e) => e.is_active)),
    [employees, showArchived],
  );

  const roleName = (roleId?: string) => roles.find((r) => r.id === roleId)?.name || roleId || "—";

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
    setMessage("");
    try {
      await createEmployee({
        data: {
          name,
          phone,
          password: form.password,
          roleId: form.roleId || "operator",
        },
      });
      setForm({ name: "", phone: "", password: "", roleId: form.roleId });
      setMessage("تمت إضافة الموظف وحساب الدخول.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر إنشاء الموظف والحساب";
      if (/Unauthorized/i.test(msg)) {
        setError(
          "انتهت الجلسة أو لا تملك صلاحية إدارة الموظفين. إن ظهر الموظف في القاعدة بدون حساب استخدم «إنشاء حساب دخول».",
        );
      } else if (/Forbidden|permission/i.test(msg)) {
        setError("حسابك لا يملك صلاحية إدارة الموظفين أو الحسابات.");
      } else {
        setError(msg);
      }
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setSaving(false);
    }
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setEditForm({ name: emp.name || "", phone: emp.phone || "" });
    setError("");
    setMessage("");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const name = editForm.name.trim();
    const phone = editForm.phone.trim();
    if (!name || !phone) {
      setError("الاسم ورقم الهاتف مطلوبان للتعديل.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateEmployee({ data: { id: editing.id, name, phone } });
      setEditing(null);
      setMessage("تم تحديث بيانات الموظف.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function onArchive(id: string) {
    if (!window.confirm("أرشفة هذا الموظف وإيقاف حسابه؟")) return;
    try {
      await archiveEmployee({ data: { id } });
      setMessage("تمت أرشفة الموظف.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر أرشفة الموظف");
    }
  }

  async function onRestore(id: string) {
    try {
      await restoreEmployee({ data: { id } });
      setMessage("تمت استعادة الموظف.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر استعادة الموظف");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("حذف الموظف نهائيًا من النظام؟ لا يمكن التراجع.")) return;
    try {
      await deleteEmployee({ data: { id } });
      setMessage("تم حذف الموظف.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الموظف");
    }
  }

  async function onRole(employeeId: string, roleId: string) {
    try {
      await setEmployeeRole({ data: { employeeId, roleId } });
      setMessage("تم تحديث دور الموظف.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الدور");
    }
  }

  async function onAccountStatus(employeeId: string, isActive: boolean) {
    try {
      await setEmployeeAccountStatus({ data: { employeeId, isActive } });
      setMessage(isActive ? "تم تفعيل الحساب." : "تم إيقاف الحساب.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث حالة الحساب");
    }
  }

  async function onResetPassword(employeeId: string) {
    const password = window.prompt("اكتب كلمة مرور جديدة للحساب (8 أحرف على الأقل):") || "";
    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    try {
      await resetEmployeePassword({ data: { employeeId, password } });
      setError("");
      setMessage("تم تغيير كلمة المرور. يدخل الموظف برقم هاتفه وكلمة المرور الجديدة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تغيير كلمة المرور");
    }
  }

  async function onCreateAccount(employeeId: string) {
    const password = window.prompt("كلمة مرور لحساب الدخول (8 أحرف على الأقل):") || "";
    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    const roleId = form.roleId || roles[0]?.id || "operator";
    try {
      await createEmployeeAccount({ data: { employeeId, password, roleId } });
      setError("");
      setMessage("تم إنشاء حساب الدخول. يسجّل الموظف برقم هاتفه وكلمة المرور.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء حساب الدخول");
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-stone-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Link to="/settings">الإعدادات</Link>
              <ArrowRight className="size-4 rotate-180" />
              <span>الموظفون</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">الموظفون ومستخدمو النظام</h1>
            <p className="mt-1 text-sm text-zinc-500">
              عرض كل الموظفين من قاعدة البيانات، تعديل بياناتهم، حذف/أرشفة، وربط حساب الدخول
              والصلاحيات.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/settings/access-control"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              <ShieldCheck className="size-4" />
              الأدوار والصلاحيات
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <form
          onSubmit={onCreateEmployee}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" />
            إضافة موظف ومستخدم للنظام
          </h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">الاسم</span>
              <input
                required
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600"
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">رقم الهاتف</span>
              <input
                required
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600"
                value={form.phone}
                onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">كلمة المرور</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="8 أحرف على الأقل"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-amber-600"
                value={form.password}
                onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-600">الدور</span>
              <select
                className="w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.roleId}
                onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            disabled={saving}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ…" : "إضافة الموظف"}
          </button>
        </form>

        {editing && (
          <form
            onSubmit={onSaveEdit}
            className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">تعديل الموظف: {editing.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">الاسم</span>
                <input
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  value={editForm.name}
                  onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">رقم الهاتف</span>
                <input
                  required
                  type="tel"
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((v) => ({ ...v, phone: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <div className="font-semibold">
              قائمة الموظفين
              <span className="mr-2 text-sm font-normal text-zinc-500">
                ({visible.length} من {employees.length})
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              إظهار المؤرشفين
            </label>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-zinc-500">جاري التحميل…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-right">الموظف</th>
                    <th className="px-4 py-3 text-right">الحساب</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">الدور / الصلاحيات</th>
                    <th className="px-4 py-3 text-right">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visible.map((e) => (
                    <tr key={e.id} className={!e.is_active ? "opacity-60" : ""}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-zinc-500" dir="ltr">
                          {e.phone || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {e.user_id ? (
                          <span className="text-emerald-700">مرتبط بحساب دخول</span>
                        ) : (
                          <span className="text-amber-700">غير مرتبط</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!e.is_active ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
                            مؤرشف
                          </span>
                        ) : e.user_id ? (
                          <button
                            type="button"
                            onClick={() => void onAccountStatus(e.id, e.account_active !== true)}
                            className={`rounded-full px-3 py-1 text-xs font-bold ${e.account_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {e.account_active ? "حساب فعال" : "حساب موقوف"}
                          </button>
                        ) : (
                          <span className="text-zinc-400">بدون حساب</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {e.user_id ? (
                          <select
                            className="rounded-lg border px-2 py-1"
                            value={e.roles?.[0] || ""}
                            onChange={(ev) => void onRole(e.id, ev.target.value)}
                          >
                            <option value="" disabled>
                              اختر دورًا
                            </option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                        {e.roles?.[0] && (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {roleName(e.roles[0])}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1 text-zinc-800"
                          >
                            <Pencil className="size-3.5" />
                            تعديل
                          </button>
                          {!e.user_id && e.is_active && (
                            <button
                              type="button"
                              onClick={() => void onCreateAccount(e.id)}
                              className="rounded-lg border border-emerald-300 px-3 py-1 text-emerald-800"
                            >
                              إنشاء حساب دخول
                            </button>
                          )}
                          {e.user_id && e.is_active && (
                            <button
                              type="button"
                              onClick={() => void onResetPassword(e.id)}
                              className="rounded-lg border border-amber-300 px-3 py-1 text-amber-800"
                            >
                              كلمة المرور
                            </button>
                          )}
                          {e.is_active ? (
                            <button
                              type="button"
                              onClick={() => void onArchive(e.id)}
                              className="rounded-lg border border-orange-200 px-3 py-1 text-orange-800"
                            >
                              أرشفة
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onRestore(e.id)}
                              className="rounded-lg border border-sky-200 px-3 py-1 text-sky-800"
                            >
                              استعادة
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDelete(e.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1 text-red-700"
                          >
                            <Trash2 className="size-3.5" />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        لا يوجد موظفون في القائمة. إن كانوا موجودين في Supabase وتظهر هذه الرسالة،
                        تأكد من صلاحية employees.read وتحديث الصفحة بعد رفع الإصلاح.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
