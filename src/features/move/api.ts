import { MOVE_API, MOVE_MESSAGES } from "@/constants/move";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { moveCreateInput, stockMoveDto, stockRowListDto, warehouseLayoutDto } from "./schemas";

import type { z } from "zod";
import type { MoveCreateInput, StockMove, StockRow, WarehouseLayout } from "./types";

// The shared client unwraps `{ success, data }` and turns failures into `ApiError` (errorCode,
// fieldErrors, correlationId). A success body that does not match the DTO is a contract failure.
function parseContract<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(502, "INVALID_MOVE_CONTRACT", MOVE_MESSAGES.invalidContract);
  }
  return result.data;
}

/**
 * `POST /inventory/movements` — idempotent on `requestId`: resending the same id returns the move
 * already made. The caller keeps one id per distinct form content (see `useMoveRequestId`).
 */
export async function createMove(input: MoveCreateInput, requestId: string): Promise<StockMove> {
  const parsed = moveCreateInput.parse(input);
  const { data } = await api.post<unknown>(MOVE_API.move, {
    requestId,
    sku: parsed.sku,
    lotNumber: parsed.lotNumber || undefined,
    fromLocation: parsed.fromLocation,
    toLocation: parsed.toLocation,
    quantity: parsed.quantity,
  });
  return parseContract(stockMoveDto, data);
}

/** `GET /inventory/stock-items?sku=` — rows of one SKU by location (inventory-stock-items:READ). */
export async function listStockRows(sku: string, signal?: AbortSignal): Promise<StockRow[]> {
  const { data } = await api.get<unknown>(MOVE_API.stockItems, { params: { sku }, signal });
  return parseContract(stockRowListDto, data);
}

/** `GET /warehouses/{id}/layout` — the whole map (warehouse-locations:READ). */
export async function getWarehouseLayout(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseLayout> {
  const { data } = await api.get<unknown>(MOVE_API.layout(warehouseId), { signal });
  return parseContract(warehouseLayoutDto, data);
}
