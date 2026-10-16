import { INVENTORY_API } from "@/constants/inventory";

import {
  adjustmentCreateInput,
  adjustmentListInput,
  adjustmentPageDto,
  adjustmentRejectionInput,
  movementListInput,
  movementPageDto,
  stockAdjustmentDto,
} from "./schemas";
import { inventoryRequest } from "./transport";

import type {
  AdjustmentListParams,
  CreateAdjustmentInput,
  MovementListParams,
  RejectAdjustmentInput,
} from "./types";

export function listMovements(params: MovementListParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.movements, params: movementListInput.parse(params), signal },
    movementPageDto,
  );
}

export function listAdjustments(params: AdjustmentListParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.adjustments, params: adjustmentListInput.parse(params), signal },
    adjustmentPageDto,
  );
}

export function getAdjustment(id: string, signal?: AbortSignal) {
  return inventoryRequest({ url: INVENTORY_API.adjustment(id), signal }, stockAdjustmentDto);
}

export function createAdjustment(input: CreateAdjustmentInput) {
  const parsed = adjustmentCreateInput.parse(input);
  return inventoryRequest(
    {
      url: INVENTORY_API.adjustments,
      method: "POST",
      data: {
        ...parsed,
        lotNumber: parsed.lotNumber || undefined,
        note: parsed.note || undefined,
      },
    },
    stockAdjustmentDto,
  );
}

export function approveAdjustment(id: string) {
  return inventoryRequest({ url: INVENTORY_API.approval(id), method: "POST" }, stockAdjustmentDto);
}

export function rejectAdjustment(id: string, input: RejectAdjustmentInput) {
  return inventoryRequest(
    {
      url: INVENTORY_API.rejection(id),
      method: "POST",
      data: adjustmentRejectionInput.parse(input),
    },
    stockAdjustmentDto,
  );
}

export function withdrawAdjustment(id: string) {
  return inventoryRequest(
    { url: INVENTORY_API.withdrawal(id), method: "POST" },
    stockAdjustmentDto,
  );
}
