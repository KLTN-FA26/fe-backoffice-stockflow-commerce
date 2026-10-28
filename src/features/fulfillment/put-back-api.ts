/**
 * Trả hàng về kệ — API layer, khớp BE `FulfillmentController` (SCRUM-275). Parse tại biên; thao tác ghi gửi
 * `Idempotency-Key` (`lib/api/idempotency`).
 */

import { PICK_LINE_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { toPickLine } from "./pick-line-api";
import { bePickLineSchema } from "./pick-line-schemas";
import { bePutBackRowPageSchema } from "./put-back-schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { PickLine, PutBackLineInput, PutBackRow } from "./types";

export interface ListPutBackParams {
  /** Vắng = mọi kho trong phạm vi người gọi; kho ngoài phạm vi → 403 OUT_OF_DATA_SCOPE. */
  warehouseId?: string;
}

/**
 * Hàng đợi trả về kệ, cũ nhất trước (BE sắp `pickedAt`). Một trang tối đa 200 dòng (Pages.MAX_PAGE_SIZE) —
 * màn tìm / lọc trên trang này; nhiều hơn thì màn báo đang hiện bao nhiêu.
 */
export async function listPutBacks(
  { warehouseId }: ListPutBackParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PutBackRow>> {
  const { data } = await api.get<unknown>("/fulfillment/put-backs", {
    params: { page: 0, size: PICK_LINE_LIMITS.pageSize, ...(warehouseId ? { warehouseId } : {}) },
    signal,
  });
  return bePutBackRowPageSchema.parse(data);
}

/**
 * Trả mọi hàng một dòng đã lấy về một bin đang hoạt động của kho task (thành tồn khả dụng). Bất kỳ ai có
 * `fulfillment-picking:UPDATE` của kho đó làm được; gửi lại cho dòng đã trả → 200 như cũ.
 */
export async function putBackLine({
  taskId,
  lineId,
  locationCode,
  idempotencyKey,
}: PutBackLineInput): Promise<PickLine> {
  const { data } = await api.post<unknown>(
    `/fulfillment/tasks/${encodeURIComponent(taskId)}/pick-lines/${encodeURIComponent(lineId)}/put-back`,
    { locationCode },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toPickLine(bePickLineSchema.parse(data));
}
