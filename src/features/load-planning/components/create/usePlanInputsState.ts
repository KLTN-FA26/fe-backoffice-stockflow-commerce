import { useState } from "react";

import type { LoadPlanSelectionMode } from "@/constants";
import type { PlanInputs } from "@/features/load-planning/plan-types";

const toggled = (set: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Đầu vào đang soạn của một kế hoạch: lô (nguyên lô), loại xe, chế độ — dùng chung cho lập mới và đổi đầu vào. */
export function usePlanInputsState(initial?: Partial<PlanInputs>) {
  const [shipments, setShipments] = useState<ReadonlySet<string>>(new Set(initial?.shipmentIds));
  const [vehicleTypes, setVehicleTypes] = useState<ReadonlySet<string>>(
    new Set(initial?.vehicleTypeIds),
  );
  const [mode, setMode] = useState<LoadPlanSelectionMode>(initial?.selectionMode ?? "SINGLE_TYPE");

  return {
    shipments,
    vehicleTypes,
    mode,
    toggleShipment: (id: string) => setShipments((current) => toggled(current, id)),
    setShipments: (ids: readonly string[]) => setShipments(new Set(ids)),
    toggleVehicleType: (id: string) => setVehicleTypes((current) => toggled(current, id)),
    setMode,
  };
}

export type PlanInputsState = ReturnType<typeof usePlanInputsState>;
