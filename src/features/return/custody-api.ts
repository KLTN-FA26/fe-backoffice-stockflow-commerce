/**
 * Hàng giữ hộ khách sau một yêu cầu không hoàn tiền (WF-05 Q-4 / TH-6, audit r2 returns H1) — BE `StockPackageController`:
 * danh sách thùng giữ hộ (`inventory-stock-packages:READ`, theo kho của người xem) và Quản lý kho ghi đã thực hiện lựa chọn
 * của khách (`inventory-stock-packages:UPDATE`). Không có bút toán kho: thùng đã ngoài sổ từ lúc yêu cầu kết thúc.
 */

import { CUSTOMER_CUSTODY_API } from "@/constants/returns";
import { api } from "@/lib/api/client";

import { customerCustodyDtoSchema, customerCustodyPageDtoSchema } from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CustomerCustodyCarton } from "./types";

export interface CustomerCustodyParams {
  /** Chỉ thùng của một yêu cầu trả hàng. */
  returnRequestId?: string;
  /** true = các thùng đã gửi trả / đã huỷ hộ; mặc định = đang giữ. */
  ended?: boolean;
  page?: number;
  size?: number;
}

export async function listCustomerCustody(
  params: CustomerCustodyParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomerCustodyCarton>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 50),
    ended: String(params.ended ?? false),
  });
  if (params.returnRequestId) query.set("returnRequestId", params.returnRequestId);
  const { data } = await api.get<unknown>(CUSTOMER_CUSTODY_API.list, { params: query, signal });
  return customerCustodyPageDtoSchema.parse(data);
}

/**
 * Quản lý kho ghi đã giao trả / đã huỷ hộ đúng lựa chọn khách (ghi chú = số biên bản, bắt buộc ≤ 500). 404
 * STOCK_PACKAGE_NOT_FOUND (cả thùng không giữ hộ), 409 STOCK_PACKAGE_DECISION_PENDING (chưa có lựa chọn),
 * INVALID_STOCK_PACKAGE_TRANSITION (đã thực hiện).
 */
export async function endCustomerCustody(input: {
  lpn: string;
  note: string;
}): Promise<CustomerCustodyCarton> {
  const { data } = await api.post<unknown>(CUSTOMER_CUSTODY_API.end(input.lpn), {
    note: input.note.trim(),
  });
  return customerCustodyDtoSchema.parse(data);
}
