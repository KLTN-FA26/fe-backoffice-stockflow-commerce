"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { beUuid } from "@/lib/validation/primitives";

import { CLEARED_PRICE_TABLE_PARAMS, PRICE_TABLE_PARSERS } from "./price-table-params";

/** Tên tham số URL giữ khách đang chọn (`/admin/customer-prices?customerId=`). */
export const CUSTOMER_ID_PARAM = "customerId";

/**
 * Khách đang chọn — URL là nguồn duy nhất (F5, link gửi đi, Back/Forward đều giữ đúng). Id sai dạng
 * không bao giờ dùng để gọi API; UUID chữ hoa được hạ về chữ thường (cùng khoá cache, BE trả chữ thường).
 * Chọn / bỏ chọn là một bước lịch sử (`push`) để Back quay về khách trước.
 */
export function useSelectedCustomer() {
  const [state, setState] = useQueryStates({ customerId: parseAsString, ...PRICE_TABLE_PARSERS });
  const raw = state.customerId;
  // Đổi khách: xoá luôn ô tìm + lọc cột của bảng giá khách trước (cùng một bước lịch sử)
  const setRaw = (customerId: string | null) =>
    void setState({ customerId, ...CLEARED_PRICE_TABLE_PARAMS }, { history: "push" });
  const text = raw?.trim() ?? "";
  const valid = text !== "" && beUuid.safeParse(text).success;
  return {
    customerId: valid ? text.toLowerCase() : null,
    /** Có `customerId` trên URL nhưng sai dạng. */
    invalid: text !== "" && !valid,
    select: (customerId: string) => setRaw(customerId),
    clear: () => setRaw(null),
  };
}

export type SelectedCustomer = ReturnType<typeof useSelectedCustomer>;
