import { useState } from "react";

import type { LoadPlanSelectionMode, LoadPlanSourceType } from "@/constants";
import type { PlanInputs } from "@/features/load-planning/plan-types";

const toggled = (set: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * Đầu vào đang soạn của một kế hoạch: nguồn (đơn khách / lệnh chuyển kho), lô (nguyên lô) HOẶC đúng một lệnh chuyển
 * kho, loại xe, chế độ — dùng chung cho lập mới và đổi đầu vào. Lựa chọn của hai nguồn giữ riêng: đổi qua lại không mất.
 */
export function usePlanInputsState(initial?: Partial<PlanInputs>) {
  const [sourceType, setSourceType] = useState<LoadPlanSourceType>(initial?.sourceType ?? "ORDER");
  const [transferId, setTransferId] = useState(initial?.transferOrderIds?.[0] ?? "");
  const [shipments, setShipments] = useState<ReadonlySet<string>>(new Set(initial?.shipmentIds));
  const [vehicleTypes, setVehicleTypes] = useState<ReadonlySet<string>>(
    new Set(initial?.vehicleTypeIds),
  );
  const [mode, setMode] = useState<LoadPlanSelectionMode>(initial?.selectionMode ?? "SINGLE_TYPE");

  return {
    sourceType,
    setSourceType,
    transferId,
    setTransferId,
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
