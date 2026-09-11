/**
 * ربط الشاشات والقوائم بصلاحيات الأدوار.
 * أي صلاحية واحدة من القائمة تكفي لفتح الشاشة.
 * الحساب بلا صلاحيات لا يرى إلا الرئيسية (بعد تحميل الصلاحيات من الخادم).
 */

export const ROUTE_ACCESS: Record<string, string[]> = {
  "/": [], // الرئيسية متاحة للجميع المسجّلين
  "/sales": ["invoice.write", "invoice.create", "invoice.edit", "invoice.approve", "invoice.cancel", "invoice.delete"],
  "/inventory": ["product.write", "warehouse.write", "category.write", "inventory.issue", "inventory.adjust"],
  "/vouchers": ["voucher.write"],
  "/cashbox": ["voucher.write", "reports.read"],
  "/expenses": ["expense.write"],
  "/reports": ["reports.read", "audit.read"],
  "/parties": ["party.write"],
  "/settings": ["settings.write", "sync.write", "db.reset", "employees.read", "employees.manage", "roles.manage", "users.manage"],
  "/employees": ["employees.read", "employees.manage", "users.manage"],
  "/settings/access-control": ["roles.manage", "users.manage", "employees.manage"],
};

/** وصف عربي للشاشات في واجهة الصلاحيات */
export const PAGE_LABELS: { path: string; title: string; permissionIds: string[] }[] = [
  { path: "/sales", title: "المبيعات والفواتير", permissionIds: ROUTE_ACCESS["/sales"] },
  { path: "/inventory", title: "المخزن والمخزون", permissionIds: ROUTE_ACCESS["/inventory"] },
  { path: "/parties", title: "العملاء والموردون", permissionIds: ROUTE_ACCESS["/parties"] },
  { path: "/vouchers", title: "السندات", permissionIds: ROUTE_ACCESS["/vouchers"] },
  { path: "/cashbox", title: "الصندوق", permissionIds: ROUTE_ACCESS["/cashbox"] },
  { path: "/expenses", title: "المصروفات", permissionIds: ROUTE_ACCESS["/expenses"] },
  { path: "/reports", title: "التقارير", permissionIds: ROUTE_ACCESS["/reports"] },
  { path: "/settings", title: "الإعدادات", permissionIds: ROUTE_ACCESS["/settings"] },
  { path: "/employees", title: "الموظفون", permissionIds: ROUTE_ACCESS["/employees"] },
  { path: "/settings/access-control", title: "الأدوار والصلاحيات", permissionIds: ROUTE_ACCESS["/settings/access-control"] },
];

export function hasAnyPermission(
  userPermissions: string[] | undefined | null,
  required: string[],
): boolean {
  if (!required.length) return true;
  const perms = userPermissions || [];
  if (!perms.length) return false;
  return required.some((p) => perms.includes(p));
}

export function canAccessPath(
  pathname: string,
  userPermissions: string[] | undefined | null,
): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  // تطابق أطول مسار أولاً
  const keys = Object.keys(ROUTE_ACCESS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized === key || (key !== "/" && normalized.startsWith(key + "/"))) {
      return hasAnyPermission(userPermissions, ROUTE_ACCESS[key]);
    }
  }
  // مسارات غير معرّفة: اسمح فقط إن كان لديه أي صلاحية إدارية
  return hasAnyPermission(userPermissions, ["settings.write", "roles.manage", "employees.manage"]);
}

export function filterNavByPermissions<T extends { to: string }>(
  items: readonly T[],
  userPermissions: string[] | undefined | null,
): T[] {
  return items.filter((item) => canAccessPath(item.to, userPermissions));
}
