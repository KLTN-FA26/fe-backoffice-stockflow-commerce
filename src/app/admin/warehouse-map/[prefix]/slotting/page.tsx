import { Lightbulb } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { WarehouseScope } from "@/features/warehouse-map/components/workspace/WarehouseScope";

import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

/** Gợi ý vị trí của một kho (docs 06 slotting) — chưa có API, giữ chỗ trong phạm vi kho. */
export default async function SlottingPage({ params }: { params: Promise<{ prefix: string }> }) {
  const { prefix } = await params;
  return (
    <div className="surface-soft surface-compact">
      <WarehouseScope prefix={decodeURIComponent(prefix)}>
        <ComingSoonPage title={UI_LABELS.warehouseMap.workspace.pages.slotting} icon={Lightbulb} />
      </WarehouseScope>
    </div>
  );
}
