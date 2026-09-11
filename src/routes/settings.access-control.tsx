import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users, KeyRound, ArrowRight, Plus } from "lucide-react";
import {
  createRole,
  getEmployeeRoles,
  listEmployees,
  listPermissions,
  listRolePermissionIds,
  setEmployeeRole,
  setRolePermissions,
} from "../server/employees";
import { useCurrentUserState } from "../lib/auth/use-current-user";

export const Route = createFileRoute("/settings/access-control")({
  component: AccessControlSettingsPage,
});

type Employee = {
  id: string;
  name: string;
  phone?: string | null;
  is_active: boolean;
  user_id?: string | null;
  user_email?: string | null;
  roles?: string[];
  account_active?: boolean;
};
type Role = { id: string; name: string; description?: string | null; permission_count?: number };
type Permission = { id: string; name: string };

/** تجميع الصلاحيات حسب الشاشة/الإجراء لسهولة تحديد وصول الموظف */
const PERMISSION_GROUPS: { title: string; description: string; ids: string[] }[] = [
  {
    title: "المبيعات والفواتير",
    description: "إنشاء، تعديل، اعتماد، إلغاء وحذف الفواتير",
    ids: [
      "invoice.write",
      "invoice.create",
      "invoice.edit",
      "invoice.approve",
      "invoice.cancel",
      "invoice.delete",
    ],
  },
  {
    title: "المخزن والمخزون",
    description: "المنتجات والمخازن والصرف والتسوية",
    ids: [
      "product.write",
      "warehouse.write",
      "category.write",
      "inventory.issue",
      "inventory.adjust",
    ],
  },
  {
    title: "العملاء والموردون",
    description: "إدارة الأطراف والأرصدة",
    ids: ["party.write"],
  },
  {
    title: "السندات والصندوق",
    description: "سندات القبض والصرف",
    ids: ["voucher.write"],
  },
  {
    title: "المصروفات",
    description: "تسجيل وإدارة المصروفات",
    ids: ["expense.write"],
  },
  {
    title: "التقارير والسجلات",
    description: "عرض التقارير وسجل التدقيق",
    ids: ["reports.read", "audit.read"],
  },
  {
    title: "المزامنة والإعدادات",
    description: "مزامنة البيانات وإعدادات النظام",
    ids: ["sync.write", "settings.write", "db.reset"],
  },
  {
    title: "الموظفون والصلاحيات",
    description: "إدارة الموظفين والحسابات والأدوار",
    ids: ["employees.read", "employees.manage", "users.manage", "roles.manage"],
  },
];

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

export default function AccessControlSettingsPage() {
  const { user, isPending: isSessionPending } = useCurrentUserState();
  const [tab, setTab] = useState<"employees" | "roles">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleForEmployee, setRoleForEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [showArchived, setShowArchived] = useState(true);

  async function load(preferredRoleId?: string) {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, roleRows] = await Promise.all([listEmployees(), getEmployeeRoles()]);
      const nextEmployees = ((employeeRows as Employee[]) || []).map((e) => ({
        ...e,
        roles: normalizeRoles(e.roles),
      }));
      const nextRoles = roleRows as Role[];
      setEmployees(nextEmployees);
      setRoles(nextRoles);
      const nextRole = preferredRoleId || selectedRole || nextRoles[0]?.id || "";
      if (nextRole) setSelectedRole(nextRole);
      if (!selectedEmployee && nextEmployees[0]?.id) setSelectedEmployee(nextEmployees[0].id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر تحميل إعدادات الصلاحيات";
      if (/Unauthorized/i.test(msg)) setError("الجلسة غير صالحة. سجّل الدخول مجددًا.");
      else if (/Forbidden|permission/i.test(msg)) setError("لا تملك صلاحية إدارة الوصول.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoleData(roleId: string) {
    if (!roleId) return;
    setLoadingPermissions(true);
    setError("");
    try {
      const [permissionRows, rolePermissionIds] = await Promise.all([
        listPermissions(),
        listRolePermissionIds({ data: { roleId } }),
      ]);
      setPermissions(permissionRows as Permission[]);
      setSelectedPermissions((rolePermissionIds as string[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل صلاحيات الدور");
    } finally {
      setLoadingPermissions(false);
    }
  }

  useEffect(() => {
    if (isSessionPending || !user) return;
    void load();
  }, [isSessionPending, user]);

  useEffect(() => {
    if (tab === "roles" && selectedRole) void loadRoleData(selectedRole);
  }, [tab, selectedRole]);

  const visibleEmployees = useMemo(
    () => (showArchived ? employees : employees.filter((e) => e.is_active)),
    [employees, showArchived],
  );
  const activeEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployee),
    [employees, selectedEmployee],
  );
  const selectedRoleRow = useMemo(
    () => roles.find((r) => r.id === selectedRole),
    [roles, selectedRole],
  );

  const permissionById = useMemo(() => {
    const map = new Map<string, Permission>();
    for (const p of permissions) map.set(p.id, p);
    return map;
  }, [permissions]);

  const groupedPermissions = useMemo(() => {
    const known = new Set<string>();
    const groups = PERMISSION_GROUPS.map((g) => {
      const items = g.ids.map((id) => permissionById.get(id)).filter(Boolean) as Permission[];
      items.forEach((p) => known.add(p.id));
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
    const other = permissions.filter((p) => !known.has(p.id));
    if (other.length) {
      groups.push({
        title: "صلاحيات أخرى",
        description: "صلاحيات إضافية في النظام",
        ids: other.map((p) => p.id),
        items: other,
      });
    }
    return groups;
  }, [permissions, permissionById]);

  useEffect(() => {
    setRoleForEmployee(activeEmployee?.roles?.[0] || "operator");
  }, [activeEmployee]);

  async function saveEmployeeRole() {
    if (!selectedEmployee || !roleForEmployee) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await setEmployeeRole({ data: { employeeId: selectedEmployee, roleId: roleForEmployee } });
      setMessage("تم تحديث دور الموظف بنجاح.");
      await load(selectedRole);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث دور الموظف");
    } finally {
      setSaving(false);
    }
  }

  async function saveRolePermissions() {
    if (!selectedRole || selectedRole === "admin") return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await setRolePermissions({
        data: { roleId: selectedRole, permissionIds: selectedPermissions },
      });
      setMessage(
        "تم حفظ صلاحيات الدور. الموظفون بهذا الدور يحصلون على الشاشات والإجراءات المحددة.",
      );
      await loadRoleData(selectedRole);
      await load(selectedRole);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ صلاحيات الدور");
    } finally {
      setSaving(false);
    }
  }

  async function createCustomRole() {
    const id = newRoleId.trim().toLowerCase();
    const name = newRoleName.trim();
    if (!/^[a-z0-9._-]{2,50}$/.test(id) || !name) {
      setError("أدخل معرّف دور إنجليزيًا صالحًا واسم الدور.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createRole({ data: { id, name, description: newRoleDescription.trim() } });
      setNewRoleId("");
      setNewRoleName("");
      setNewRoleDescription("");
      setMessage("تم إنشاء الدور. حدّد صلاحياته الآن.");
      await load(id);
      setTab("roles");
      await loadRoleData(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الدور");
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(ids: string[], checked: boolean) {
    setSelectedPermissions((current) => {
      if (checked) return [...new Set([...current, ...ids])];
      return current.filter((id) => !ids.includes(id));
    });
  }

  return (
    <div dir="rtl" className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link to="/settings" className="hover:text-brand">
              الإعدادات
            </Link>
            <ArrowRight className="size-4 rotate-180" />
            <span>الوصول والصلاحيات</span>
          </div>
          <h1 className="page-title mt-2">إدارة الوصول</h1>
          <p className="page-subtitle">
            كل الموظفين من قاعدة البيانات، تعيين الأدوار، وتحديد الشاشات والإجراءات المسموحة لكل
            دور.
          </p>
        </div>
        <Link to="/employees" className="btn-ghost">
          <Users className="size-4" />
          إدارة الموظفين
        </Link>
      </div>

      {(error || message) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error ? "border-bad/30 bg-bad-soft text-bad" : "border-good/30 bg-good-soft text-good"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line">
          <button
            type="button"
            onClick={() => setTab("employees")}
            className={`flex items-center justify-center gap-2 px-5 py-4 text-sm font-black ${
              tab === "employees" ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas"
            }`}
          >
            <Users className="size-4" />
            الموظفون والأدوار ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("roles")}
            className={`flex items-center justify-center gap-2 px-5 py-4 text-sm font-black ${
              tab === "roles" ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas"
            }`}
          >
            <KeyRound className="size-4" />
            الأدوار وصلاحيات الشاشات
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">جاري تحميل بيانات الوصول…</div>
        ) : tab === "employees" ? (
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-canvas/50 px-4 py-3">
                <span className="font-black">الموظفون</span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  إظهار المؤرشفين
                </label>
              </div>
              <div className="divide-y divide-line max-h-[28rem] overflow-y-auto">
                {visibleEmployees.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => setSelectedEmployee(e.id)}
                    className={`flex w-full items-center justify-between gap-3 p-4 text-right transition ${
                      selectedEmployee === e.id ? "bg-brand-soft/70" : "hover:bg-canvas"
                    }`}
                  >
                    <div>
                      <div className="font-bold">{e.name}</div>
                      <div className="mt-1 text-xs text-muted" dir="ltr">
                        {e.phone || "—"} · {e.user_id ? "حساب مرتبط" : "بدون حساب دخول"}
                      </div>
                      {e.roles?.[0] && (
                        <div className="mt-1 text-[11px] text-brand">
                          {roles.find((r) => r.id === e.roles?.[0])?.name || e.roles[0]}
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        e.is_active ? "bg-good-soft text-good" : "bg-canvas text-muted"
                      }`}
                    >
                      {e.is_active ? "فعال" : "مؤرشف"}
                    </span>
                  </button>
                ))}
                {!visibleEmployees.length && (
                  <div className="p-8 text-center text-sm text-muted">
                    لا يوجد موظفون. أضفهم من شاشة إدارة الموظفين.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas/40 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="font-black">تعيين الدور للموظف</h2>
                  <p className="text-xs text-muted">
                    الدور يحدد الشاشات والإجراءات. عدّل صلاحيات الدور من تبويب «الأدوار وصلاحيات
                    الشاشات».
                  </p>
                </div>
              </div>
              {activeEmployee ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-white p-4">
                    <p className="font-bold">{activeEmployee.name}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {activeEmployee.phone || "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {activeEmployee.user_id
                        ? "حساب دخول مرتبط — يمكن تعيين الدور"
                        : "أنشئ حساب الدخول أولًا من شاشة الموظفين"}
                    </p>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-2 block font-bold">الدور</span>
                    <select
                      className="input-field"
                      value={roleForEmployee}
                      onChange={(e) => setRoleForEmployee(e.target.value)}
                      disabled={!activeEmployee.user_id}
                    >
                      <option value="">اختر دورًا</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!activeEmployee.user_id || saving || !roleForEmployee}
                    onClick={() => void saveEmployeeRole()}
                    className="btn-primary w-full"
                  >
                    {saving ? "جارٍ الحفظ…" : "حفظ الدور"}
                  </button>
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted">اختر موظفًا من القائمة.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 p-6 lg:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="border-b border-line bg-canvas/50 px-4 py-3 font-black">
                  الأدوار
                </div>
                <div className="divide-y divide-line">
                  {roles.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelectedRole(r.id)}
                      className={`w-full p-4 text-right ${selectedRole === r.id ? "bg-brand-soft/70" : "hover:bg-canvas"}`}
                    >
                      <div className="font-bold">{r.name}</div>
                      <div className="mt-1 text-xs text-muted">{r.description || "بدون وصف"}</div>
                      <div className="mt-2 text-[11px] text-brand">
                        {r.permission_count ?? 0} صلاحية
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-canvas/40 p-4">
                <div className="flex items-center gap-2 font-black">
                  <Plus className="size-4 text-brand" />
                  إنشاء دور مخصص
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    className="input-field"
                    placeholder="المعرّف: warehouse.staff"
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="اسم الدور بالعربية"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="الوصف (اختياري)"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void createCustomRole()}
                    className="btn-secondary w-full"
                  >
                    إنشاء الدور
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas/40 p-5">
              <div>
                <h2 className="font-black">
                  صلاحيات {selectedRoleRow?.name || "الدور"} — الشاشات والإجراءات
                </h2>
                <p className="text-xs text-muted">
                  فعّل ما يحتاجه الدور فقط. الحفظ يطبّق فورًا على كل موظف بهذا الدور عبر الخادم.
                </p>
              </div>
              {loadingPermissions ? (
                <div className="p-8 text-center text-sm text-muted">جاري تحميل الصلاحيات…</div>
              ) : (
                <>
                  <div className="mt-5 space-y-4">
                    {groupedPermissions.map((group) => {
                      const ids = group.items.map((p) => p.id);
                      const allOn = ids.every((id) => selectedPermissions.includes(id));
                      const someOn = ids.some((id) => selectedPermissions.includes(id));
                      return (
                        <div
                          key={group.title}
                          className="rounded-2xl border border-line bg-white p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-black">{group.title}</div>
                              <div className="text-xs text-muted">{group.description}</div>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-bold">
                              <input
                                type="checkbox"
                                checked={allOn}
                                disabled={selectedRole === "admin" || saving}
                                ref={(el) => {
                                  if (el) el.indeterminate = someOn && !allOn;
                                }}
                                onChange={(e) => toggleGroup(ids, e.target.checked)}
                              />
                              تحديد الكل
                            </label>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.items.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-canvas/40 p-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(p.id)}
                                  disabled={selectedRole === "admin" || saving}
                                  onChange={(e) =>
                                    setSelectedPermissions((current) =>
                                      e.target.checked
                                        ? [...new Set([...current, p.id])]
                                        : current.filter((id) => id !== p.id),
                                    )
                                  }
                                />
                                <span>
                                  <span className="block font-bold">{p.name}</span>
                                  <span className="text-[10px] text-muted">{p.id}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedRole || saving || selectedRole === "admin"}
                    onClick={() => void saveRolePermissions()}
                    className="btn-primary mt-5 w-full"
                  >
                    {selectedRole === "admin"
                      ? "صلاحيات مدير النظام محمية"
                      : saving
                        ? "جارٍ الحفظ…"
                        : "حفظ صلاحيات الدور والشاشات"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
