import type { LucideIcon } from "lucide-react";
import { Construction, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";

type ComingSoonProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

/**
 * شاشة مؤقتة للميزات المتوقفة — تظهر بدل المحتوى الكامل دون حذف الكود.
 */
export function ComingSoon({
  title,
  description = "هذه الميزة قيد التطوير وسنُفعّلها لاحقًا. يمكنك متابعة العمل على باقي الشاشات كالمعتاد.",
  icon: Icon = Construction,
}: ComingSoonProps) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} />
      <div className="card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="relative">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-brand-soft text-brand">
            <Icon className="size-10" />
          </span>
          <span className="absolute -bottom-1 -left-1 flex size-8 items-center justify-center rounded-full bg-accent text-white shadow-md">
            <Sparkles className="size-4" />
          </span>
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-black text-ink">قريبًا</h2>
          <p className="text-sm font-bold leading-relaxed text-muted">{description}</p>
        </div>
        <p className="rounded-2xl bg-canvas px-4 py-2 text-xs font-black text-muted">
          الميزة محفوظة في النظام وستُشغَّل لاحقًا بطلبك
        </p>
      </div>
    </div>
  );
}
