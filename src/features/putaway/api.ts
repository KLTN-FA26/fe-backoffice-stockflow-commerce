/**
 * Cất hàng — API layer, khớp BE `PutawayController` (docs 05). Parse tại biên; xác nhận cất gửi `Idempotency-Key`
 * (`lib/api/idempotency`).
 */

import { PUTAWAY_API, PUTAWAY_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { bePutawayTaskPageSchema, bePutawayTaskSchema } from "./schemas";

import type { ConfirmPutawayInput, PutawayTask, PutawayTaskPage } from "./types";

export interface ListPutawayParams {
  [key: string]: unknown;
  /** Theo kho: chỉ nhiệm vụ PENDING / IN_PROGRESS có thùng đang ở kho đó. */
  warehouseId?: string;
  /** Theo phiếu nhập: mọi nhiệm vụ của phiếu, kể cả đã cất. BE ưu tiên khi gửi cả hai. */
  receiptId?: string;
}

/**
 * Danh sách nhiệm vụ (docs 05 §4.2). BE bắt buộc một trong hai `warehouseId` / `receiptId` (400 VALIDATION_FAILED),
 * không có tìm kiếm / sắp xếp — màn lấy một trang 200 dòng (Pages.MAX_PAGE_SIZE) rồi lọc ở client.
 */
export async function listPutawayTasks(
  { warehouseId, receiptId }: ListPutawayParams,
  signal?: AbortSignal,
): Promise<PutawayTaskPage> {
  const { data } = await api.get<unknown>(PUTAWAY_API.tasks, {
    params: {
      page: 0,
      size: PUTAWAY_LIMITS.pageSize,
      ...(receiptId ? { receiptId } : warehouseId ? { warehouseId } : {}),
    },
    signal,
  });
  return bePutawayTaskPageSchema.parse(data);
}

/** Một nhiệm vụ kèm tối đa 10 bin gợi ý tính lúc xem (docs 05 §4.3) — không lưu, mỗi lần mở là tính lại. */
export async function getPutawayTask(id: string, signal?: AbortSignal): Promise<PutawayTask> {
  const { data } = await api.get<unknown>(PUTAWAY_API.task(id), { signal });
  return bePutawayTaskSchema.parse(data);
}

/**
 * Cất nguyên thùng vào bin quét được (docs 05 §4.4): BE kiểm lại luật cứng trên bin đó dưới hàng đợi theo bin (BR-09),
 * ghi tồn khả dụng + sổ kho (BR-10, BR-12), nhiệm vụ thành DONE và đóng phiếu nhập khi thùng cuối được cất.
 */
export async function confirmPutaway({
  taskId,
  values,
  idempotencyKey,
}: ConfirmPutawayInput): Promise<PutawayTask> {
  const { data } = await api.post<unknown>(
    PUTAWAY_API.confirmation(taskId),
    { lpn: values.lpn, locationCode: values.locationCode },
    idempotencyRequestConfig(idempotencyKey),
  );
  return bePutawayTaskSchema.parse(data);
}
