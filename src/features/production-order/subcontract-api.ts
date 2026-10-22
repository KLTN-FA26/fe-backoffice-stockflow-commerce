/**
 * Gia công ngoài — thao tác xử lý sự cố (BE local integration d215f6e, SubcontractService).
 * QA2 (SPRINT2-FINISH-DECISIONS 2026-10-13): nhà gia công bỏ dở khi đơn khách còn hiệu lực →
 * thu hồi / đối soát phôi, chuyển phần chưa làm sang LSX MỚI tại xưởng; giữ hàng đã QC đạt;
 * phí thoả thuận do quản lý nhập, không tự chi.
 */

import { api } from "@/lib/api/client";

import { productionDetailDtoSchema } from "./schemas";

import type { ProductionDetail } from "./types";

const byId = (id: string) => `/production/orders/${encodeURIComponent(id)}`;

/** Thu hồi phôi đang ở nhà gia công (chỉ hình thức gửi phôi). `requestId` idempotent. */
export async function recallBlanks(i: {
  id: string;
  requestId: string;
  returned: number;
  spoilt: number;
  returnLocation?: string;
  note?: string;
}): Promise<void> {
  const { id, ...body } = i;
  await api.post<unknown>(`${byId(id)}/subcontract-recall`, body);
}

/** Chuyển phần còn nợ về xưởng → BE trả LSX MỚI tại xưởng (origin SHORTFALL / REPLACEMENT). */
export async function takeInHouse(i: {
  id: string;
  quantity: number;
  reason: string;
  packingLocation?: string;
}): Promise<ProductionDetail> {
  const { id, ...body } = i;
  const { data } = await api.post<unknown>(`${byId(id)}/subcontract-in-house`, body);
  return productionDetailDtoSchema.parse(data);
}

/** Đặt thêm cho nhà gia công: PO nháp đổi số lượng; PO đã duyệt → tạo yêu cầu điều chỉnh chờ duyệt. */
export async function supplementSubcontract(i: {
  id: string;
  quantity: number;
  reason: string;
}): Promise<ProductionDetail> {
  const { id, ...body } = i;
  const { data } = await api.post<unknown>(`${byId(id)}/subcontract-supplement`, body);
  return productionDetailDtoSchema.parse(data);
}
