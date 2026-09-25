import { useState } from "react";
import { Check, Database, Pencil, Plus, Tags, Warehouse, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Chip, SectionCard } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

type EditingState = { kind: "warehouse" | "category"; id: string } | null;

/**
 * المخازن والفئات
 * ---------------
 * كان التعديل يجري عبر نوافذ `window.prompt` التي لا تعمل جيدًا على الجوال
 * وتخرج من تصميم النظام. الآن التعديل **داخل الصف نفسه** بحقل وزرَّي حفظ وإلغاء.
 */
export function CatalogPanel() {
  const warehouses = useStore((s) => s.warehouses || []);
  const productCategories = useStore((s) => s.productCategories || []);
  const addWarehouse = useStore((s) => s.addWarehouse);
  const updateWarehouse = useStore((s) => s.updateWarehouse);
  const addProductCategory = useStore((s) => s.addProductCategory);
  const updateProductCategory = useStore((s) => s.updateProductCategory);

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editing, setEditing] = useState<EditingState>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (kind: "warehouse" | "category", id: string, value: string) => {
    setEditing({ kind, id });
    setEditValue(value);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const commitEdit = () => {
    const name = editValue.trim();
    if (!editing) return;
    if (!name) {
      toast.error(editing.kind === "warehouse" ? "أدخل اسم المخزن" : "أدخل اسم الفئة");
      return;
    }
    if (editing.kind === "warehouse") updateWarehouse(editing.id, { name });
    else updateProductCategory(editing.id, { name });
    toast.success("تم حفظ التعديل");
    cancelEdit();
  };

  const createWarehouse = () => {
    if (!warehouseName.trim()) {
      toast.error("أدخل اسم المخزن");
      return;
    }
    addWarehouse({ name: warehouseName, location: warehouseLocation });
    setWarehouseName("");
    setWarehouseLocation("");
    toast.success("تمت إضافة المخزن");
  };

  const createCategory = () => {
    if (!categoryName.trim()) {
      toast.error("أدخل اسم الفئة");
      return;
    }
    addProductCategory(categoryName);
    setCategoryName("");
    toast.success("تمت إضافة الفئة");
  };

  const rowActions = (
    kind: "warehouse" | "category",
    id: string,
    name: string,
    isActive: boolean,
    toggle: () => void,
  ) =>
    editing?.kind === kind && editing.id === id ? (
      <>
        <button type="button" className="btn-success px-3 text-xs" onClick={commitEdit} title="حفظ">
          <Check className="size-4" />
          حفظ
        </button>
        <button type="button" className="btn-ghost px-3 text-xs" onClick={cancelEdit} title="إلغاء">
          <X className="size-4" />
          إلغاء
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          className="btn-ghost px-3 text-xs"
          onClick={() => startEdit(kind, id, name)}
        >
          <Pencil className="size-3.5" />
          تعديل
        </button>
        <button
          type="button"
          className={cn("btn-ghost px-3 text-xs", isActive && "text-bad")}
          onClick={toggle}
        >
          {isActive ? "تعطيل" : "تفعيل"}
        </button>
      </>
    );

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      <SectionCard
        title="المخازن"
        subtitle="تُستخدم في إدخال وإخراج البضاعة والتقارير"
        icon={Warehouse}
        tone="good"
        action={<Chip tone="muted">{warehouses.length}</Chip>}
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input-field"
            placeholder="اسم المخزن"
            value={warehouseName}
            onChange={(event) => setWarehouseName(event.target.value)}
          />
          <input
            className="input-field"
            placeholder="الموقع (اختياري)"
            value={warehouseLocation}
            onChange={(event) => setWarehouseLocation(event.target.value)}
          />
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={createWarehouse}>
            <Plus className="size-4" />
            إضافة
          </button>
        </div>

        <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {warehouses.map((warehouse) => {
            const isEditing = editing?.kind === "warehouse" && editing.id === warehouse.id;
            return (
              <div key={warehouse.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      className="input-field"
                      value={editValue}
                      autoFocus
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitEdit();
                        if (event.key === "Escape") cancelEdit();
                      }}
                    />
                  ) : (
                    <>
                      <p className={cn("font-bold", !warehouse.isActive && "text-muted line-through")}>
                        {warehouse.name}
                      </p>
                      <p className="text-xs text-muted">{warehouse.location || "بدون موقع"}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rowActions("warehouse", warehouse.id, warehouse.name, warehouse.isActive, () =>
                    updateWarehouse(warehouse.id, { isActive: !warehouse.isActive }),
                  )}
                </div>
              </div>
            );
          })}
          {!warehouses.length && (
            <div className="p-4 text-center text-xs text-muted">لا توجد مخازن بعد</div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="فئات المنتجات"
        subtitle="تصنيف الأصناف لتسهيل البحث والتقارير"
        icon={Tags}
        tone="gold"
        action={<Chip tone="muted">{productCategories.length}</Chip>}
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="input-field"
            placeholder="اسم الفئة"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={createCategory}>
            <Plus className="size-4" />
            إضافة
          </button>
        </div>

        <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {productCategories.map((category) => {
            const isEditing = editing?.kind === "category" && editing.id === category.id;
            return (
              <div key={category.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      className="input-field"
                      value={editValue}
                      autoFocus
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitEdit();
                        if (event.key === "Escape") cancelEdit();
                      }}
                    />
                  ) : (
                    <p className={cn("font-bold", !category.isActive && "text-muted line-through")}>
                      {category.name}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rowActions("category", category.id, category.name, category.isActive, () =>
                    updateProductCategory(category.id, { isActive: !category.isActive }),
                  )}
                </div>
              </div>
            );
          })}
          {!productCategories.length && (
            <div className="p-4 text-center text-xs text-muted">لا توجد فئات بعد</div>
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 text-[11px] font-bold text-muted">
          <Database className="mt-0.5 size-3.5 shrink-0" />
          تعطيل المخزن أو الفئة يخفيها من قوائم الإدخال دون حذف أي حركة مرتبطة بها.
        </p>
      </SectionCard>
    </div>
  );
}
