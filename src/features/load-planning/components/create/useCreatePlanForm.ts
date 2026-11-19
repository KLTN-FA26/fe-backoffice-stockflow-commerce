import { useState } from "react";

import { useAppStore } from "@/lib/store/use-app-store";
import { createPlanFormSchema } from "@/features/load-planning/input-schemas";
import { useActiveVehicleTypes, useLoadPlanCandidates } from "@/features/load-planning/queries";

import { shipmentIdsToSend } from "./shipment-selection";
import { usePlanInputsState } from "./usePlanInputsState";
import { useStartLoadPlan } from "./useStartLoadPlan";

/**
 * State của màn lập kế hoạch: kho, đầu vào (lô giao nguyên shipment, loại xe, chế độ), ghi chú, kiểm tra zod trước khi gửi.
 * Kế hoạch chỉ lập từ lô giao của đơn khách (docs 09 §4.2 bước 1; BE `CreateLoadPlanRequest.sourceType` chỉ nhận ORDER). Lô đã chọn mà không còn trong danh sách ứng viên (người khác vừa lập kế hoạch với nó) bị bỏ khi gửi,
 * không gửi id mồ côi.
 */
export function useCreatePlanForm() {
  const defaultWarehouse = useAppStore((state) => state.warehouseId);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse ?? "");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputs = usePlanInputsState();
  const candidates = useLoadPlanCandidates(warehouseId);
  const types = useActiveVehicleTypes();
  const starter = useStartLoadPlan();

  const changeWarehouse = (next: string) => {
    setWarehouseId(next);
    // Lô thuộc kho cũ: bỏ chọn
    inputs.setShipments([]);
    setFieldError(null);
  };

  const submit = () => {
    const vehicleTypeIds = [...inputs.vehicleTypes];
    const rest = { warehouseId, vehicleTypeIds, selectionMode: inputs.mode, note };
    const known = new Set(candidates.data?.map((c) => c.shipmentId));
    const shipmentIds = shipmentIdsToSend([...inputs.shipments], known, rest);
    const parsed = createPlanFormSchema.safeParse({ ...rest, shipmentIds });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setFieldError(null);
    void starter.start(parsed.data);
  };

  return {
    warehouseId,
    changeWarehouse,
    note,
    setNote,
    inputs,
    candidates,
    types,
    submit,
    fieldError,
    serverError: starter.error,
    pending: starter.pending,
  };
}
