/**
 * Transfer order — API layer, khớp BE `TransferOrderController` (`/api/v1/inventory/transfer-orders`).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`. Parse tại biên (api-conventions §3.2).
 * Không có endpoint nhận hàng: kho đích nhận là SCRUM-328 (chưa có).
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beTransferOrderSchema, beTransferPageSchema } from "./schemas";

import type { TransferStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  DispatchTransferInput,
  TransferFormValues,
  TransferOrder,
  TransferOrderRow,
  TransferReasonInput,
  UpdateTransferInput,
} from "./types";

export const TRANSFERS_PATH = "/inventory/transfer-orders";

/** Spring bind `@RequestParam List<TransferStatus> status` từ `status=A&status=B`. */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

export const transferPath = (id: string) => `${TRANSFERS_PATH}/${encodeURIComponent(id)}`;

/* ── List / detail ───────────────────────────────────────────────────── */

export interface ListTransferParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  status?: TransferStatus[];
  fromWarehouseId?: string;
  toWarehouseId?: string;
  /** BE so khớp số lệnh (`TO-…`, chứa chuỗi). */
  search?: string;
}

export async function listTransferOrders(
  params: ListTransferParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<TransferOrderRow>> {
  const { data } = await api.get<unknown>(TRANSFERS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      status: params.status?.length ? params.status : undefined,
      fromWarehouseId: params.fromWarehouseId || undefined,
      toWarehouseId: params.toWarehouseId || undefined,
      search: params.search?.trim() || undefined,
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return beTransferPageSchema.parse(data);
}

export async function getTransferOrder(id: string, signal?: AbortSignal): Promise<TransferOrder> {
  const { data } = await api.get<unknown>(transferPath(id), { signal });
  return beTransferOrderSchema.parse(data);
}

/* ── Tạo / sửa nháp ──────────────────────────────────────────────────── */

/** Form → body BE `CreateTransferOrderRequest` (chuỗi rỗng → bỏ field tuỳ chọn). */
export function toTransferRequest(values: TransferFormValues) {
  return {
    fromWarehouseId: values.fromWarehouseId,
    toWarehouseId: values.toWarehouseId,
    reason: values.reason || undefined,
    expectedDate: values.expectedDate || undefined,
    deliveryMode: values.deliveryMode,
    lines: values.lines.map((line) => ({
      sku: line.sku,
      lotNumber: line.lotNumber || undefined,
      quantity: line.quantity,
    })),
  };
}

async function postTransfer(path: string, body?: unknown): Promise<TransferOrder> {
  const { data } = await api.post<unknown>(path, body);
  return beTransferOrderSchema.parse(data);
}

export const createTransferOrder = (values: TransferFormValues) =>
  postTransfer(TRANSFERS_PATH, toTransferRequest(values));

/** Sửa lệnh DRAFT: gửi cả lệnh + `version` đã đọc; dòng mới thay toàn bộ dòng cũ (SCRUM-462). */
export async function updateTransferOrder({
  transferId,
  version,
  values,
}: UpdateTransferInput): Promise<TransferOrder> {
  const { data } = await api.put<unknown>(transferPath(transferId), {
    version,
    ...toTransferRequest(values),
  });
  return beTransferOrderSchema.parse(data);
}

/* ── Chuyển trạng thái ───────────────────────────────────────────────── */

/** Gửi duyệt — tổng SL ≤ ngưỡng thì BE duyệt luôn (APPROVED), không thì PENDING_APPROVAL. */
export const submitTransferOrder = (id: string) => postTransfer(`${transferPath(id)}/submission`);

export const approveTransferOrder = (id: string) => postTransfer(`${transferPath(id)}/approval`);

export const rejectTransferOrder = ({ transferId, reason }: TransferReasonInput) =>
  postTransfer(`${transferPath(transferId)}/rejection`, { reason });

export const startTransferPicking = (id: string) => postTransfer(`${transferPath(id)}/picking`);

export const cancelTransferPicking = (id: string) =>
  postTransfer(`${transferPath(id)}/picking-cancellation`);

/** Xuất kho ở kho nguồn: PICKING → IN_TRANSIT, trừ tồn nguồn, giữ hàng ở trạng thái đi đường. */
export const dispatchTransferOrder = ({ transferId, lines }: DispatchTransferInput) =>
  postTransfer(`${transferPath(transferId)}/dispatch`, { lines });

/** BR-04 (docs 10 §6): chỉ huỷ trước khi xuất kho. */
export const cancelTransferOrder = ({ transferId, reason }: TransferReasonInput) =>
  postTransfer(`${transferPath(transferId)}/cancellation`, { reason });
