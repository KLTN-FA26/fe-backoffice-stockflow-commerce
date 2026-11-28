/**
 * Hạn mức / dư nợ và sale liên hệ gần nhất của một trang khách (audit bo-29). Mỗi endpoint gọi một lần với id của trang.
 * `null` = không dùng được: 403 (không có quyền), 404 / 400 (BE chưa có endpoint — PR #497 chưa vào) → danh sách ẩn
 * cột, không vỡ trang.
 */

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  creditPositionListDtoSchema,
  LIST_EXTRAS_MAX_IDS,
  salesContactListDtoSchema,
} from "./list-extras-schemas";

import type { CreditPosition, SalesContact } from "./types";

function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && [400, 403, 404].includes(error.status);
}

async function getByCustomerIds<T extends { customerId: string }>(
  path: string,
  customerIds: readonly string[],
  parse: (data: unknown) => T[],
  signal?: AbortSignal,
): Promise<Map<string, T> | null> {
  const ids = [...new Set(customerIds)].slice(0, LIST_EXTRAS_MAX_IDS);
  if (ids.length === 0) return new Map();
  try {
    const { data } = await api.get<unknown>(path, {
      params: new URLSearchParams({ customerIds: ids.join(",") }),
      signal,
    });
    return new Map(parse(data).map((item) => [item.customerId, item]));
  } catch (error) {
    if (isUnavailable(error)) return null;
    throw error;
  }
}

/** `GET /orders/credit-positions` — theo id khách; khách không có hạn mức vẫn có phần tử (dư nợ, quá hạn). */
export function listCreditPositions(
  customerIds: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, CreditPosition> | null> {
  return getByCustomerIds(
    "/orders/credit-positions",
    customerIds,
    (data) => creditPositionListDtoSchema.parse(data),
    signal,
  );
}

/** `GET /orders/sales-contacts` — khách chưa từng được gửi báo giá / hợp đồng không có phần tử. */
export function listSalesContacts(
  customerIds: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, SalesContact> | null> {
  return getByCustomerIds(
    "/orders/sales-contacts",
    customerIds,
    (data) => salesContactListDtoSchema.parse(data),
    signal,
  );
}
