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
import {
  atpDto,
  atpInput,
  reservationListInput,
  reservationPageDto,
  stockAlertListInput,
  stockAlertPageDto,
  stockLevelsDto,
  stockLevelsInput,
  warehouseStockItemPageDto,
  warehouseStockItemsInput,
} from "./stock-schemas";
import { inventoryRequest } from "./transport";

import type {
  AdjustmentListParams,
  AtpParams,
  CreateAdjustmentInput,
  MovementListParams,
  RejectAdjustmentInput,
  ReservationListParams,
  StockAlertListParams,
  StockLevelsParams,
  WarehouseStockItemsParams,
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

// ── Inventory overview reads (SCRUM-438) ─────────────────────────────────────────────────────
// Paging stays zero-based here, as on the wire; the UI converts its one-based page.

export function getStockLevels(params: StockLevelsParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.stockLevels, params: stockLevelsInput.parse(params), signal },
    stockLevelsDto,
  );
}

export function listWarehouseStockItems(params: WarehouseStockItemsParams, signal?: AbortSignal) {
  const { warehouseId, ...query } = warehouseStockItemsInput.parse(params);
  return inventoryRequest(
    { url: INVENTORY_API.warehouseStockItems(warehouseId), params: query, signal },
    warehouseStockItemPageDto,
  );
}

export function getAtp(params: AtpParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.atp, params: atpInput.parse(params), signal },
    atpDto,
  );
}

export function listReservations(params: ReservationListParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.reservations, params: reservationListInput.parse(params), signal },
    reservationPageDto,
  );
}

export function listStockAlerts(params: StockAlertListParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: INVENTORY_API.alerts, params: stockAlertListInput.parse(params), signal },
    stockAlertPageDto,
  );
}
