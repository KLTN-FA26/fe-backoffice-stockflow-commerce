import { useCallback, useState } from "react";

import { toggled, useToggleSet } from "./useToggleSet";

import type { LoadPlanSelectionMode } from "@/constants";
import type { PlanInputs } from "@/features/load-planning/plan-types";

/**
 * Đầu vào đang soạn của một kế hoạch: lô (nguyên lô), loại xe, chế độ — dùng chung cho lập mới và đổi đầu vào.
 * `shipmentsTouched` / `vehicleTypesTouched`: người dùng đã tự chọn — từ đó màn không điền sẵn đè lên (R6: chỉ điền
 * sẵn khi người dùng chưa chạm vào).
 */
export function usePlanInputsState(initial?: Partial<PlanInputs>) {
  const [shipments, setShipments] = useState<ReadonlySet<string>>(new Set(initial?.shipmentIds));
  const [vehicleTypes, setVehicleTypes] = useState<ReadonlySet<string>>(
    new Set(initial?.vehicleTypeIds),
  );
  const [shipmentsTouched, setShipmentsTouched] = useState(false);
  const [vehicleTypesTouched, setVehicleTypesTouched] = useState(false);
  const [mode, setMode] = useState<LoadPlanSelectionMode>(initial?.selectionMode ?? "SINGLE_TYPE");
  // Dòng đơn tick là hàng chèn (RTM-LPGROUP): mặc định không dòng nào — mọi dòng là hàng chính
  const fill = useToggleSet(initial?.fillOrderLineIds);
  // Ổn định giữa các lần render để effect điền sẵn của màn lập kế hoạch dùng làm dependency
  const presetShipments = useCallback((ids: readonly string[]) => setShipments(new Set(ids)), []);
  const presetVehicleTypes = useCallback(
    (ids: readonly string[]) => setVehicleTypes(new Set(ids)),
    [],
  );

  return {
    shipments,
    vehicleTypes,
    mode,
    fillLines: fill.ids,
    toggleFillLine: fill.toggle,
    shipmentsTouched,
    vehicleTypesTouched,
    toggleShipment: (id: string) => {
      setShipmentsTouched(true);
      setShipments((current) => toggled(current, id));
    },
    setShipments: (ids: readonly string[]) => {
      setShipmentsTouched(true);
      setShipments(new Set(ids));
    },
    toggleVehicleType: (id: string) => {
      setVehicleTypesTouched(true);
      setVehicleTypes((current) => toggled(current, id));
    },
    /** Điền sẵn từ hệ thống (lô duy nhất, loại xe của ước tính) — không tính là người dùng đã chọn. */
    presetShipments,
    presetVehicleTypes,
    /** Đổi kho: lô của kho cũ bỏ đi, người dùng chưa chọn gì ở kho mới. */
    resetShipments: () => {
      setShipmentsTouched(false);
      setShipments(new Set());
    },
    setMode,
  };
}

export type PlanInputsState = ReturnType<typeof usePlanInputsState>;
