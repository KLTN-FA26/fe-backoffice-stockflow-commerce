import { useState } from "react";

import { LOAD_ESTIMATE_LABELS, LOAD_PLAN_SELECTION_MODE } from "@/constants";

import { estimateErrorMessage, packagingMissingItemIds } from "../../estimate-errors";
import {
  useCreateLoadEstimate,
  useCurrentEstimate,
  useEstimateVehicleTypes,
} from "../../estimate-queries";
import { CreateEstimateInputSchema } from "../../estimate-schemas";
import { useToggleSet } from "../create/useToggleSet";

import type { SelectionMode } from "./EstimateControls";

/** Một dòng của đơn (đủ để vẽ ô "Hàng chèn"). */
export interface EstimateOrderLine {
  lineId: string;
  sku: string;
  quantity: number;
}

interface EstimatePanelInput {
  orderId: string;
  warehouseId: string | null;
  released: boolean;
  lines: readonly EstimateOrderLine[];
  canCreate: boolean;
  canRead: boolean;
}

/**
 * State của ngăn kéo ước tính: ước tính hiện hành (GET), loại xe, cách chọn xe, dòng tick là hàng chèn (mặc định không
 * dòng nào, RTM-LPGROUP), lỗi, và `run` kiểm zod rồi POST. Chỉ "Ưu tiên + hàng chèn" gửi hàng chèn.
 */
export function useEstimatePanel({
  orderId,
  warehouseId,
  released,
  lines,
  canCreate,
  canRead,
}: EstimatePanelInput) {
  const L = LOAD_ESTIMATE_LABELS;
  const current = useCurrentEstimate(orderId, canRead);
  const vehicleTypes = useEstimateVehicleTypes(canCreate);
  const create = useCreateLoadEstimate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SelectionMode>(LOAD_PLAN_SELECTION_MODE.SINGLE_TYPE);
  const fill = useToggleSet();
  const [error, setError] = useState<{ message: string; itemIds: string[] } | null>(null);
  const priorityFill = mode === LOAD_PLAN_SELECTION_MODE.PRIORITY_FILL;

  const run = () => {
    const input = CreateEstimateInputSchema.safeParse({
      orderId,
      warehouseId: released ? null : warehouseId,
      vehicleTypeIds: selectedIds,
      selectionMode: mode,
      fillOrderLineIds: priorityFill
        ? lines.map((l) => l.lineId).filter((id) => fill.ids.has(id))
        : undefined,
    });
    if (!input.success) {
      setError({ message: L.controls.tooManyTypes, itemIds: [] });
      return;
    }
    setError(null);
    create.mutate(input.data, {
      onError: (apiError) =>
        setError({
          message: estimateErrorMessage(apiError),
          itemIds: packagingMissingItemIds(apiError),
        }),
    });
  };

  return {
    current,
    vehicleTypes,
    create,
    selectedIds,
    setSelectedIds,
    mode,
    setMode,
    priorityFill,
    fill,
    error,
    run,
    estimate: create.data ?? current.data ?? null,
    blockedReason: !released && !warehouseId ? L.selectWarehouseFirst : null,
  };
}
