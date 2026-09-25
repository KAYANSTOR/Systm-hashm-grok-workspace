import { Cloud, Database, Download, Info, ShieldCheck, Store, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/kit";

/**
 * سجل أقسام الإعدادات — مصدر واحد للحقيقة
 * ----------------------------------------
 * كان كل شيء في ملف واحد بطول 700 سطر، والقائمة مكتوبة يدويًا داخل الصفحة.
 * الآن كل قسم له تعريف واحد هنا (المعرّف، الاسم، الوصف، الأيقونة، اللون،
 * والمجموعة)، وتَستهلكه: قائمة التنقّل، وصفحة النظرة العامة، والراوتر المحلي
 * للتبويبات — فأي قسم جديد يُضاف في مكان واحد فقط.
 */

export type SettingsSectionId =
  | "overview"
  | "organization"
  | "account"
  | "sync"
  | "catalog"
  | "backup"
  | "danger";

export type SettingsGroupId = "general" | "system" | "data" | "risk";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  /** تسمية مختصرة لشبكة الجوال حتى لا تُقطع الكلمات الطويلة. */
  short: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  group: SettingsGroupId;
};

export const SETTINGS_GROUPS: ReadonlyArray<{ id: SettingsGroupId; label: string }> = [
  { id: "general", label: "عام" },
  { id: "system", label: "إعدادات النظام" },
  { id: "data", label: "البيانات" },
  { id: "risk", label: "منطقة الخطر" },
];

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  {
    id: "overview",
    label: "نظرة عامة",
    short: "نظرة عامة",
    hint: "حالة النظام والمختصرات",
    icon: Info,
    tone: "brand",
    group: "general",
  },
  {
    id: "organization",
    label: "بيانات المعمل",
    short: "بيانات المعمل",
    hint: "الاسم والشعار والترويسة",
    icon: Store,
    tone: "brand",
    group: "system",
  },
  {
    id: "account",
    label: "الحساب والوصول",
    short: "الحساب",
    hint: "المستخدم الحالي والموظفون",
    icon: ShieldCheck,
    tone: "navy",
    group: "system",
  },
  {
    id: "sync",
    label: "التخزين والمزامنة",
    short: "المزامنة",
    hint: "الطابور والنسخة السحابية",
    icon: Cloud,
    tone: "accent",
    group: "system",
  },
  {
    id: "catalog",
    label: "المخازن والفئات",
    short: "المخازن والفئات",
    hint: "تقسيمات المخزون والتقارير",
    icon: Database,
    tone: "good",
    group: "data",
  },
  {
    id: "backup",
    label: "النسخ الاحتياطي",
    short: "النسخ الاحتياطي",
    hint: "تصدير واستعادة البيانات",
    icon: Download,
    tone: "good",
    group: "data",
  },
  {
    id: "danger",
    label: "منطقة الخطر",
    short: "منطقة الخطر",
    hint: "حذف وتصفية البيانات",
    icon: Trash2,
    tone: "bad",
    group: "risk",
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "overview";

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}
