/**
 * Yêu cầu trả hàng — API layer (BE `ReturnRequestController`, `ReturnResolutionController`). Parse tại biên.
 * Bước của nhân viên gửi `version` màn đang thấy: bản ghi đã đổi → 409 `OPTIMISTIC_LOCK` thay vì quyết trên dữ liệu cũ.
 */

import { api } from "@/lib/api/client";
import { uploadSlotSchema } from "@/lib/api/direct-upload";

import { evidenceLinkDtoSchema, returnPageDtoSchema, returnRequestDtoSchema } from "./schemas";

import type { ReturnApiStatus, ReturnReason } from "@/constants/returns";
import type { UploadDeclaration, UploadSlot } from "@/lib/api/direct-upload";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { ReturnRequest, ReturnRow } from "./types";

const RETURNS = "/returns";
const seg = encodeURIComponent;

export interface ListReturnParams extends ListQueryParams {
  /** BE nhận nhiều `status` (lặp tham số). */
  statuses?: readonly ReturnApiStatus[];
  customerId?: string;
  orderId?: string;
  /** Số RMA hoặc mã đơn. */
  search?: string;
  /** true = đã hoàn tiền, cần hoá đơn điều chỉnh giảm (docs 21 §4.4). */
  vatAdjustment?: boolean;
}

export async function listReturns(
  params: ListReturnParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReturnRow>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  for (const status of params.statuses ?? []) query.append("status", status);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.vatAdjustment !== undefined) query.set("vatAdjustment", String(params.vatAdjustment));
  if (params.sort) query.set("sort", params.sort);
  const { data } = await api.get<unknown>(RETURNS, { params: query, signal });
  return returnPageDtoSchema.parse(data);
}

export async function getReturn(id: string, signal?: AbortSignal): Promise<ReturnRequest> {
  const { data } = await api.get<unknown>(`${RETURNS}/${seg(id)}`, { signal });
  return returnRequestDtoSchema.parse(data);
}

/** Link xem ảnh 5 phút (bản hiển thị, không metadata vị trí). */
export async function getEvidenceLink(returnId: string, evidenceId: string): Promise<string> {
  const { data } = await api.get<unknown>(
    `${RETURNS}/${seg(returnId)}/evidence/${seg(evidenceId)}/download-url`,
  );
  return evidenceLinkDtoSchema.parse(data).url;
}

const post = async (path: string, body?: unknown): Promise<ReturnRequest> => {
  const { data } = await api.post<unknown>(path, body);
  return returnRequestDtoSchema.parse(data);
};

/** Bỏ trường rỗng: BE `@Size` không nhận chuỗi trống thay cho "không có". */
const optional = (key: string, value: string | undefined) =>
  value?.trim() ? { [key]: value.trim() } : {};

/** Duyệt (Sale): dòng nào bỏ ra là duyệt đủ; hàng luôn phải gửi về (17 BR-18) nên không gửi `returnRequired`. */
export const approveReturn = (input: {
  id: string;
  version: number;
  lines: { lineId: string; approvedQuantity: number }[];
  note?: string;
}) =>
  post(`${RETURNS}/${seg(input.id)}/approval`, {
    lines: input.lines,
    version: input.version,
    ...optional("note", input.note),
  });

export const rejectReturn = (input: { id: string; version: number; reason: string }) =>
  post(`${RETURNS}/${seg(input.id)}/rejection`, { reason: input.reason, version: input.version });

/** Rút thay khách — chỉ khi hàng chưa về (REQUESTED / AWAITING_RETURN). */
export const cancelReturn = (input: { id: string; reason?: string }) =>
  post(`${RETURNS}/${seg(input.id)}/cancellation`, optional("reason", input.reason));

/** Sale mở thay khách (`requestId` sinh một lần cho mỗi lần mở form — gửi lại trả cùng yêu cầu). */
export const openReturnForCustomer = (input: {
  orderId: string;
  requestId: string;
  reasonCode: ReturnReason;
  description?: string;
  lateClaimReason?: string;
  /** WF-05 TH-1: lô đã giao; bỏ trống khi đơn chỉ có một lô đã giao (BE `RETURN_SHIPMENT_REQUIRED` nếu nhiều lô). */
  shipmentId?: string;
  lines: { orderLineId: string; quantity: number }[];
}) =>
  post(`/orders/${seg(input.orderId)}/returns`, {
    requestId: input.requestId,
    ...optional("shipmentId", input.shipmentId),
    reasonCode: input.reasonCode,
    requestedResolution: "REFUND",
    lines: input.lines,
    ...optional("description", input.description),
    ...optional("lateClaimReason", input.lateClaimReason),
  });

/** Đề xuất hoàn tiền của yêu cầu RECEIVED (Sale) — chờ người khác duyệt. */
export const proposeRefund = (input: {
  id: string;
  version: number;
  lines: { lineId: string; quantity: number }[];
  note?: string;
}) =>
  post(`${RETURNS}/${seg(input.id)}/resolution`, {
    lines: input.lines,
    version: input.version,
    ...optional("note", input.note),
  });

/**
 * WF-05 TH-3 (BE `POST /returns/{id}/goods-complete`, `sales-rma-resolutions:UPDATE`): về thiếu và khách không gửi thêm
 * — AWAITING_RETURN → RECEIVED theo số các phiếu đã mang về, phần thiếu ghi chênh lệch. Chưa có kiện nào về →
 * `RETURN_INVALID_TRANSITION`.
 */
export const markGoodsComplete = (input: { id: string; version: number; note?: string }) =>
  post(`${RETURNS}/${seg(input.id)}/goods-complete`, {
    version: input.version,
    ...optional("note", input.note),
  });

/**
 * WF-05 TH-4 (BE `POST /returns/{id}/closure-without-refund`): RECEIVED → RESOLVED không hoàn tiền khi không đơn vị nào
 * vừa duyệt vừa về dùng được; còn đơn vị hoàn được → `RETURN_QUANTITIES_INVALID`.
 */
export const closeWithoutRefund = (input: { id: string; version: number; note?: string }) =>
  post(`${RETURNS}/${seg(input.id)}/closure-without-refund`, {
    version: input.version,
    ...optional("note", input.note),
  });

/**
 * Bước 1 của ảnh bằng chứng tải thẳng lên kho (BE `POST /returns/{id}/evidence/uploads`, `sales-rmas:CREATE`): khai báo
 * tệp, nhận đường PUT ngắn hạn. JPEG / PNG / WebP ≤ 15 MB.
 */
export async function beginReturnEvidenceUpload(
  returnId: string,
  declaration: UploadDeclaration,
  signal?: AbortSignal,
): Promise<UploadSlot> {
  const { data } = await api.post<unknown>(
    `${RETURNS}/${seg(returnId)}/evidence/uploads`,
    declaration,
    { signal },
  );
  return uploadSlotSchema.parse(data);
}

/** Bước 3: gắn ảnh đã PUT lên kho vào yêu cầu (BE `POST /returns/{id}/evidence` `{uploadId}`, gửi lại cùng id = như cũ). */
export const attachReturnEvidence = (input: { id: string; uploadId: string }) =>
  post(`${RETURNS}/${seg(input.id)}/evidence`, { uploadId: input.uploadId });

export const approveSettlement = (input: { id: string; version: number }) =>
  post(`${RETURNS}/${seg(input.id)}/settlement-approval`, { version: input.version });

export const rejectSettlement = (input: { id: string; version: number; reason: string }) =>
  post(`${RETURNS}/${seg(input.id)}/settlement-rejection`, {
    reason: input.reason,
    version: input.version,
  });
