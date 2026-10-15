"use client";

import { parseAsString, useQueryState } from "nuqs";

import { isValidOrderCustomerId } from "../../schemas";

/** Khoá URL của bộ lọc riêng trang đơn (ngoài status/q/page/sort của `useUrlFilters`). */
export const ORDER_FILTER_KEYS = {
  customer: "customer",
  from: "from",
  to: "to",
} as const;

/** `yyyy-MM-dd` — đúng định dạng `LocalDate` BE nhận ở `placedFrom/placedTo`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bộ lọc khách / ngày đặt trên URL (state-persistence: người khác mở link phải thấy cùng danh
 * sách). Đổi bộ lọc → về trang 1 (`resetPage`). Chỉ những tham số BE `GET /orders` nhận —
 * không có phương thức thanh toán (BE chưa hỗ trợ lọc theo `paymentTerm`).
 *
 * `customer` trên URL có thể sai (link cũ, gõ tay): giữ nguyên để ô nhập hiện lỗi, nhưng chỉ
 * UUID hợp lệ mới vào `params` / query key — không bao giờ để BE trả 400 cả trang.
 */
export function useOrderExtraFilters(resetPage: () => void) {
  const [customerRaw, setCustomerId] = useQueryState(
    ORDER_FILTER_KEYS.customer,
    parseAsString.withDefault(""),
  );
  const [placedFrom, setPlacedFrom] = useQueryState(
    ORDER_FILTER_KEYS.from,
    parseAsString.withDefault(""),
  );
  const [placedTo, setPlacedTo] = useQueryState(
    ORDER_FILTER_KEYS.to,
    parseAsString.withDefault(""),
  );

  const customerInput = customerRaw.trim();
  const customerIdInvalid = customerInput !== "" && !isValidOrderCustomerId(customerInput);
  const customerId = customerIdInvalid ? "" : customerInput;
  const from = ISO_DAY.test(placedFrom) ? placedFrom : "";
  const to = ISO_DAY.test(placedTo) ? placedTo : "";
  // BE OrderServiceImpl: placedTo trước placedFrom → 400. Chặn ở FE, không gửi khoảng sai.
  const invalidRange = from !== "" && to !== "" && to < from;

  const withPageReset =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      resetPage();
    };

  return {
    /** Khách đang lọc thật (UUID hợp lệ) — "" khi không lọc hoặc giá trị URL sai. */
    customerId,
    /** Giá trị khách trên URL như người dùng thấy (có thể sai) — để ô nhập hiển thị + báo lỗi. */
    customerInput,
    customerIdInvalid,
    placedFrom: from,
    placedTo: to,
    invalidRange,
    /** Giá trị gửi API — bỏ khách / khoảng ngày sai thay vì để BE trả 400. */
    params: {
      customerId: customerId || undefined,
      placedFrom: invalidRange ? undefined : from || undefined,
      placedTo: invalidRange ? undefined : to || undefined,
    },
    active: customerId !== "" || from !== "" || to !== "",
    setCustomerId: withPageReset((v: string) => setCustomerId(v.trim() || null)),
    setPlacedFrom: withPageReset((v: string) => setPlacedFrom(v || null)),
    setPlacedTo: withPageReset((v: string) => setPlacedTo(v || null)),
    clearDates: () => {
      void setPlacedFrom(null);
      void setPlacedTo(null);
      resetPage();
    },
    reset: () => {
      void setCustomerId(null);
      void setPlacedFrom(null);
      void setPlacedTo(null);
    },
  };
}

export type OrderExtraFilters = ReturnType<typeof useOrderExtraFilters>;
