import {
  MOVE_API,
  MOVE_CARTON_STATUS_IN_STOCK,
  MOVE_LIMITS,
  MOVE_MESSAGES,
} from "@/constants/move";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  cartonDto,
  cartonPageDto,
  movedCartonsDto,
  moveCreateInput,
  warehouseLayoutDto,
} from "./schemas";

import type { z } from "zod";
import type { Carton, MovedCarton, MoveCreateInput, WarehouseLayout } from "./types";

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
 * `POST /inventory/movements` — chuyển nguyên thùng theo LPN tới một vị trí, cả danh sách hoặc không thùng nào (docs 11
 * BR-04, BR-07). Idempotent theo `requestId`: gửi lại cùng id trả đúng các thùng đã chuyển; caller giữ một id cho mỗi bộ
 * (danh sách LPN, đích) — xem `useMoveRequestId`.
 */
export async function createMove(
  input: MoveCreateInput,
  requestId: string,
): Promise<MovedCarton[]> {
  const parsed = moveCreateInput.parse(input);
  const { data } = await api.post<unknown>(MOVE_API.move, {
    requestId,
    lpns: parsed.lpns,
    toLocation: parsed.toLocation,
  });
  return parseContract(movedCartonsDto, data);
}

/**
 * `GET /inventory/stock-packages/{lpn}` (inventory-stock-packages:READ) — tra một thùng vừa quét: SKU, lô, số cái và vị
 * trí hiện tại (docs 11 §3: LPN cho biết vị trí nguồn, người dùng không nhập).
 */
export async function getCarton(lpn: string, signal?: AbortSignal): Promise<Carton> {
  const { data } = await api.get<unknown>(MOVE_API.carton(lpn), { signal });
  return parseContract(cartonDto, data);
}

/**
 * `GET /inventory/stock-packages?location|sku&status=IN_STOCK` (inventory-stock-packages:READ, một trang) — tìm thùng
 * trước khi quét: thùng của một SKU nằm ở đâu, hoặc một vị trí đang chứa thùng nào.
 */
export async function listCartons(
  query: { location: string } | { sku: string },
  signal?: AbortSignal,
): Promise<{ items: Carton[]; hasNext: boolean }> {
  const { data } = await api.get<unknown>(MOVE_API.cartons, {
    params: {
      ...query,
      status: MOVE_CARTON_STATUS_IN_STOCK,
      page: 0,
      size: MOVE_LIMITS.cartonsSize,
    },
    signal,
  });
  return parseContract(cartonPageDto, data);
}

/** `GET /warehouses/{id}/layout` — the whole map (warehouse-locations:READ). */
export async function getWarehouseLayout(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseLayout> {
  const { data } = await api.get<unknown>(MOVE_API.layout(warehouseId), { signal });
  return parseContract(warehouseLayoutDto, data);
}
