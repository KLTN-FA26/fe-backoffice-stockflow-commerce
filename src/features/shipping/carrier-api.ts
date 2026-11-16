/**
 * Shipping — API danh mục hãng vận chuyển (BE `CarrierController`, docs 09 §3, §4.1).
 *
 *   GET  /fulfillment/carriers?status&search&page&size   `fulfillment-shipments:READ` (nhân viên kho chọn từ danh mục)
 *   POST /fulfillment/carriers   → 201 `fulfillment-carriers:UPDATE` (quản lý kho); 409 CARRIER_CODE_EXISTS
 *   PUT  /fulfillment/carriers/{id}  kèm `version` đã đọc; 409 OPTIMISTIC_LOCK, CARRIER_CODE_EXISTS
 * Khoá bí mật chỉ đi vào, không bao giờ đi ra (BE chỉ nói đã đặt hay chưa). `connection` vắng = giữ nguyên cấu hình
 * hiện có (hãng mới là MANUAL) — màn hình dùng cách này để không đụng tới cấu hình API đặt xe.
 */

import { CARRIER_STATUSES, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beCarrierPageSchema, beCarrierSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { Carrier, SaveCarrierInput } from "./types";

export const CARRIERS_PATH = "/fulfillment/carriers";

export interface ListCarrierParams extends ListQueryParams {
  status?: (typeof CARRIER_STATUSES)[number];
  search?: string;
}

/** Hãng trong danh mục — chọn hãng cho chuyến chỉ lấy hãng ACTIVE. */
export async function listCarriers(
  params: ListCarrierParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Carrier>> {
  const { data } = await api.get<unknown>(CARRIERS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.masterData,
      status: params.status || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return beCarrierPageSchema.parse(data);
}

/** Khai báo hãng mới (kèm kiểu kết nối). */
export async function createCarrier(body: SaveCarrierInput): Promise<Carrier> {
  const { data } = await api.post<unknown>(CARRIERS_PATH, body);
  return beCarrierSchema.parse(data);
}

/** Sửa hãng; `body.version` là phiên bản đã đọc. */
export async function updateCarrier(carrierId: string, body: SaveCarrierInput): Promise<Carrier> {
  const { data } = await api.put<unknown>(
    `${CARRIERS_PATH}/${encodeURIComponent(carrierId)}`,
    body,
  );
  return beCarrierSchema.parse(data);
}
