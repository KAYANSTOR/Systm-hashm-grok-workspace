import { createLazyFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { INVENTORY_ENABLED } from "@/lib/features";
import { ComingSoon } from "@/components/coming-soon";
import { InventoryPageFull } from "./inventory-page";

export const Route = createLazyFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  if (!INVENTORY_ENABLED) {
    return (
      <ComingSoon
        title="المخزن"
        description="وحدة المخزن والمخازن والفئات متوقفة مؤقتًا. ستُفعَّل لاحقًا بطلبك — المنطق كامل ومحفوظ في النظام."
        icon={Boxes}
      />
    );
  }
  return <InventoryPageFull />;
}
