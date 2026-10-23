"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { colorMapForLayouts } from "@/features/load-planning/lib/palette";
import {
  isTransferPlan,
  layoutsForItemTable,
  pickedOnTray,
  unplacedLinesOf,
  unplacedParcels,
} from "@/features/load-planning/plan-selectors";
import { Alert } from "@/components/shared/Alert";

import { VehicleItemTable } from "../report/VehicleItemTable";

import { UnplacedTray } from "./UnplacedTray";
import { useVehicleRecalc } from "./useVehicleRecalc";
import { VehiclePanel } from "./VehiclePanel";
import { VehicleSwitcher } from "./VehicleSwitcher";

import type { LoadPlanActions } from "@/features/load-planning/lifecycle";
import type { PlanDetail } from "@/features/load-planning/plan-types";
import type { Layout } from "@/features/load-planning/types";

const L = UI_LABELS.loadPlan.detail;

/**
 * Tab "Xếp xe": chọn xe → khung 3D + số liệu + tính lại xe; bảng số kiện theo xe; khay kiện chưa xếp kèm "đưa lại vào
 * xe". Bố cục các xe tải bằng MỘT query `layouts` (một bản đồ màu cho cả kế hoạch). Ghi lỗi thao tác qua `onNotice`.
 */
export function LoadingTab({
  plan,
  layouts,
  layoutsFailed,
  actions,
  onNotice,
  onAcknowledge,
}: {
  plan: PlanDetail;
  layouts: readonly Layout[] | undefined;
  layoutsFailed: boolean;
  actions: LoadPlanActions;
  onNotice: (message: string | null) => void;
  onAcknowledge: () => void;
}) {
  const [seq, setSeq] = useState<number | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const recalc = useVehicleRecalc(plan, onNotice);
  const tray = unplacedParcels(plan);
  const vehicle = plan.vehicles.find((v) => v.seq === seq) ?? plan.vehicles[0];
  const colorMap = colorMapForLayouts(layouts ?? []);
  // Chỉ kiện còn trên khay mới được gửi: kiện đã lên xe sau một lần tính lại phải rời lựa chọn
  const selected = pickedOnTray(picked, tray);

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      {layoutsFailed && <Alert tone="danger">{L.layoutsFailed}</Alert>}
      {vehicle ? (
        <>
          <VehicleSwitcher vehicles={plan.vehicles} selectedSeq={vehicle.seq} onSelect={setSeq} />
          <VehiclePanel
            planId={plan.loadPlanId}
            vehicle={vehicle}
            layout={layouts?.find((layout) => layout.seq === vehicle.seq)}
            colorMap={colorMap}
            canRecalculate={actions.recalculateVehicle}
            pending={recalc.pending}
            onRecalculate={() => recalc.run(vehicle.seq)}
          />
          {layouts && (
            <VehicleItemTable
              layouts={layoutsForItemTable(layouts)}
              unplaced={unplacedLinesOf(tray)}
            />
          )}
        </>
      ) : (
        <p className="text-ink-tertiary text-sm">{L.noVehicles}</p>
      )}
      <UnplacedTray
        parcels={tray}
        acknowledged={!!plan.unplacedAcknowledgement}
        canReturn={actions.recalculateVehicle}
        canAcknowledge={actions.acknowledge}
        shipsWhole={isTransferPlan(plan)}
        vehicleSeq={vehicle?.seq ?? null}
        selected={selected}
        pending={recalc.pending}
        onToggle={toggle}
        onReturn={() =>
          vehicle && recalc.run(vehicle.seq, [...selected], () => setPicked(new Set()))
        }
        onAcknowledge={onAcknowledge}
      />
    </div>
  );
}
