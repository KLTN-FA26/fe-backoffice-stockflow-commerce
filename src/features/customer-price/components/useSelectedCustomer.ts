"use client";

import { parseAsString, useQueryState } from "nuqs";

import { beUuid } from "@/lib/validation/primitives";

/** Tên tham số URL giữ khách đang chọn (`/admin/customer-prices?customerId=`). */
export const CUSTOMER_ID_PARAM = "customerId";

/**
 * Khách đang chọn — URL là nguồn duy nhất (F5, link gửi đi, Back/Forward đều giữ đúng). Id sai dạng
 * không bao giờ dùng để gọi API; UUID chữ hoa được hạ về chữ thường (cùng khoá cache, BE trả chữ thường).
 * Chọn / bỏ chọn là một bước lịch sử (`push`) để Back quay về khách trước.
 */
export function useSelectedCustomer() {
  const [raw, setRaw] = useQueryState(CUSTOMER_ID_PARAM, parseAsString);
  const text = raw?.trim() ?? "";
  const valid = text !== "" && beUuid.safeParse(text).success;
  return {
    customerId: valid ? text.toLowerCase() : null,
    /** Có `customerId` trên URL nhưng sai dạng. */
    invalid: text !== "" && !valid,
    select: (customerId: string) => void setRaw(customerId, { history: "push" }),
    clear: () => void setRaw(null, { history: "push" }),
  };
}

export type SelectedCustomer = ReturnType<typeof useSelectedCustomer>;
